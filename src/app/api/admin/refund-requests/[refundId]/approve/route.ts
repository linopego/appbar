import { NextRequest, NextResponse } from "next/server";
import { getAdminOrManagerSession } from "@/lib/auth/admin-or-manager";
import { db } from "@/lib/db";
import { processRefund } from "@/lib/refunds/process";
import { sendRefundApprovedEmail } from "@/lib/email/refund-emails";
import { enqueueAndTryVoidDocument } from "@/lib/fiscal/emit";

// Approvazione rimborso in tre fasi (vedi src/lib/refunds/process.ts):
// 1. claim atomico PENDING/PROCESSING/FAILED → PROCESSING + lock FOR UPDATE dei ticket
// 2. refund Stripe con idempotency key `refund-{id}`
// 3. finalizzazione: ticket REFUNDED, ordine ricalcolato, refund COMPLETED, audit log
// Un refund PROCESSING (crash tra fase 2 e 3) o FAILED è ri-approvabile in sicurezza.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const session = await getAdminOrManagerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Non autenticato" }, { status: 401 });
  }

  const { refundId } = await params;
  let body: { managerNote?: string } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: {
      order: {
        include: {
          customer: true,
          venue: true,
        },
      },
    },
  });

  if (!refund) {
    return NextResponse.json({ ok: false, error: "Rimborso non trovato" }, { status: 404 });
  }

  // Manager can only approve their venue's refunds
  if (session.kind === "manager" && refund.order.venueId !== session.session.venueId) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
  }

  const actor = {
    processedBy:
      session.kind === "admin" ? session.session.adminUserId : session.session.operatorId,
    processedByType: (session.kind === "admin" ? "ADMIN_USER" : "OPERATOR") as
      | "ADMIN_USER"
      | "OPERATOR",
  };

  const result = await processRefund({
    refundId,
    actor,
    managerNote: body.managerNote?.trim() || null,
  });

  if (!result.ok) {
    switch (result.code) {
      case "ALREADY_PROCESSED":
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "ALREADY_PROCESSED",
              message: "Il rimborso è già stato processato o è in lavorazione.",
            },
          },
          { status: 409 }
        );
      case "TICKETS_CHANGED":
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "TICKETS_CHANGED",
              message:
                "Alcuni ticket non sono più rimborsabili (consumati o scaduti). Verifica e decidi se rifiutare la richiesta.",
              invalidTicketIds: result.invalidTicketIds,
            },
          },
          { status: 409 }
        );
      case "STRIPE_ERROR":
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "STRIPE_ERROR",
              message: "Errore durante il rimborso Stripe. Riprova: l'operazione è sicura.",
            },
          },
          { status: 502 }
        );
    }
  }

  // Send email notification
  const customerEmail = refund.order.customer.email;
  if (customerEmail) {
    void sendRefundApprovedEmail({
      customerEmail,
      customerName: refund.order.customer.firstName ?? customerEmail,
      venueName: refund.order.venue.name,
      refundId: refund.id,
      amount: refund.amount.toString(),
      ticketCount: (refund.ticketIds as string[]).length,
      managerNote: body.managerNote?.trim() || null,
    }).catch(console.error);
  }

  // Fiscale: storno best-effort e ASINCRONO (il rimborso non attende né
  // fallisce per il fiscale; il cron di recupero fa da rete di sicurezza)
  void enqueueAndTryVoidDocument(refund.id).catch(console.error);

  return NextResponse.json({ ok: true });
}
