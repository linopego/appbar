import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";

// ─────────────────────────────────────────────────────────────────────────────
// Macchina a stati del rimborso (approvazione)
//
//   PENDING ──claim──► PROCESSING ──Stripe ok──► COMPLETED (o APPROVED se
//      ▲                   │                      l'ordine non ha pagamento Stripe)
//      │                   └──Stripe ko──► FAILED
//      └── TICKETS_CHANGED (un ticket non è più rimborsabile: si torna PENDING
//          e il manager decide se rifiutare)
//
// RIENTRANZA: PROCESSING e FAILED sono stati "claimabili". Se il processo
// crasha tra la chiamata Stripe e la finalizzazione (refund bloccato in
// PROCESSING), o se Stripe ha risposto errore (FAILED), una nuova richiesta di
// approvazione riprende il lavoro da capo in sicurezza: il claim atomico
// esclude i concorrenti e l'idempotency key `refund-{id}` garantisce che
// Stripe non emetta MAI un secondo rimborso — restituisce l'oggetto refund
// originale della prima chiamata riuscita.
// ─────────────────────────────────────────────────────────────────────────────

export const CLAIMABLE_STATUSES = ["PENDING", "PROCESSING", "FAILED"] as const;

export interface LockedTicket {
  id: string;
  status: string;
  expiresAt: Date;
}

// Pure: dati i ticket lockati, quali fra quelli attesi non sono più rimborsabili
// (mancanti, non più ACTIVE, oppure scaduti).
export function getNonRefundableTicketIds(
  tickets: LockedTicket[],
  expectedIds: string[],
  now: Date
): string[] {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  return expectedIds.filter((id) => {
    const t = byId.get(id);
    return !t || t.status !== "ACTIVE" || t.expiresAt <= now;
  });
}

export interface ProcessRefundActor {
  processedBy: string;
  processedByType: "ADMIN_USER" | "OPERATOR";
}

export type ProcessRefundResult =
  | {
      ok: true;
      refund: {
        id: string;
        amount: string;
        ticketIds: string[];
        orderId: string;
        stripeRefundId: string | null;
      };
    }
  | { ok: false; code: "ALREADY_PROCESSED" }
  | { ok: false; code: "TICKETS_CHANGED"; invalidTicketIds: string[] }
  | { ok: false; code: "STRIPE_ERROR"; message: string };

export async function processRefund(params: {
  refundId: string;
  actor: ProcessRefundActor;
  managerNote?: string | null;
}): Promise<ProcessRefundResult> {
  const { refundId, actor, managerNote } = params;

  // ── Fase 1: claim atomico + lock dei ticket ────────────────────────────────
  const claim = await db.$transaction(async (tx) => {
    const claimed = await tx.refund.updateMany({
      where: { id: refundId, status: { in: [...CLAIMABLE_STATUSES] } },
      data: { status: "PROCESSING" },
    });
    if (claimed.count !== 1) {
      return { code: "ALREADY_PROCESSED" as const };
    }

    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      include: { order: { select: { id: true, stripePaymentId: true } } },
    });
    const ticketIds = refund.ticketIds as string[];

    // Lock pessimistico: nessun consume/invalidate può toccare questi ticket
    // finché la transazione non è chiusa.
    const locked = await tx.$queryRaw<LockedTicket[]>`
      SELECT "id", "status"::text AS "status", "expiresAt"
      FROM "Ticket"
      WHERE "id" IN (${Prisma.join(ticketIds)})
      FOR UPDATE
    `;

    const invalidTicketIds = getNonRefundableTicketIds(locked, ticketIds, new Date());
    if (invalidTicketIds.length > 0) {
      // Ticket consumato/scaduto tra richiesta e approvazione: si torna
      // PENDING, il manager deciderà se rifiutare.
      await tx.refund.update({
        where: { id: refundId },
        data: { status: "PENDING" },
      });
      return { code: "TICKETS_CHANGED" as const, invalidTicketIds };
    }

    return { code: "CLAIMED" as const, refund, ticketIds };
  });

  if (claim.code === "ALREADY_PROCESSED") return { ok: false, code: "ALREADY_PROCESSED" };
  if (claim.code === "TICKETS_CHANGED") {
    return { ok: false, code: "TICKETS_CHANGED", invalidTicketIds: claim.invalidTicketIds };
  }

  const { refund, ticketIds } = claim;
  const orderId = refund.order.id;

  // ── Fase 2: Stripe (fuori dalla transazione DB) ────────────────────────────
  let stripeRefundId: string | null = null;
  if (refund.order.stripePaymentId) {
    try {
      const stripeRefund = await stripe.refunds.create(
        {
          payment_intent: refund.order.stripePaymentId,
          amount: Math.round(Number(refund.amount) * 100), // centesimi
        },
        // Retry e doppie esecuzioni restituiscono SEMPRE lo stesso refund:
        // mai un secondo rimborso per lo stesso record.
        { idempotencyKey: `refund-${refund.id}` }
      );
      stripeRefundId = stripeRefund.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore Stripe sconosciuto";
      console.error(`[Refund ${refundId}] Stripe refund fallito:`, message);
      await db.refund.update({
        where: { id: refundId },
        data: { status: "FAILED", errorMessage: message },
      });
      return { ok: false, code: "STRIPE_ERROR", message };
    }
  }

  // ── Fase 3: finalizzazione (transazione DB) ────────────────────────────────
  const now = new Date();
  await db.$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({
      where: { id: { in: ticketIds }, status: "ACTIVE" },
      data: { status: "REFUNDED", refundedAt: now },
    });
    if (updated.count !== ticketIds.length) {
      // Non dovrebbe accadere: il claim in fase 1 ha verificato e lockato i
      // ticket. Se accade, il rimborso Stripe è già partito: log grave per
      // intervento manuale.
      console.error(
        `[Refund ${refundId}] GRAVE: aggiornati ${updated.count}/${ticketIds.length} ticket a REFUNDED dopo refund Stripe ${stripeRefundId ?? "n/a"}`
      );
    }

    const activeLeft = await tx.ticket.count({
      where: { orderId, status: "ACTIVE" },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: activeLeft > 0 ? "PARTIALLY_REFUNDED" : "REFUNDED" },
    });

    await tx.refund.update({
      where: { id: refundId },
      data: {
        status: stripeRefundId ? "COMPLETED" : "APPROVED",
        stripeRefundId,
        errorMessage: null,
        processedAt: now,
        processedBy: actor.processedBy,
        processedByType: actor.processedByType,
        ...(managerNote !== undefined ? { managerNote } : {}),
      },
    });

    // Audit SEMPRE, qualunque sia l'attore (super-admin o manager).
    await tx.adminAuditLog.create({
      data: {
        actorType: actor.processedByType,
        ...(actor.processedByType === "ADMIN_USER"
          ? { adminUserId: actor.processedBy }
          : { operatorId: actor.processedBy }),
        action: "REFUND_APPROVED",
        targetType: "Refund",
        targetId: refundId,
        payload: {
          amount: refund.amount.toString(),
          orderId,
          ticketIds,
        },
      },
    });
  });

  return {
    ok: true,
    refund: {
      id: refund.id,
      amount: refund.amount.toString(),
      ticketIds,
      orderId,
      stripeRefundId,
    },
  };
}
