import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/client";

// Invalidazione manuale dei ticket, condivisa tra responsabile (venue della
// sessione) e superadmin (venue nello scope dell'organizzazione).
// Regole: solo ticket ACTIVE, tutti dello stesso perimetro autorizzato;
// lo stato diventa REFUNDED (nessun rimborso Stripe automatico) e il cliente
// riceve un'email con la motivazione. L'audit resta al chiamante (actor
// OPERATOR vs ADMIN_USER), con la stessa action string TICKETS_INVALIDATED.

export type InvalidateResult =
  | { ok: true; invalidated: number; venueId: string; organizationId: string }
  | { ok: false; status: number; error: string | { code: string } };

export function validateInvalidateInput(body: {
  ticketIds?: unknown;
  reason?: unknown;
}): { ok: true; ticketIds: string[]; reason: string } | { ok: false; error: string } {
  if (!Array.isArray(body.ticketIds) || body.ticketIds.length === 0) {
    return { ok: false, error: "ticketIds deve essere un array non vuoto" };
  }
  if (typeof body.reason !== "string" || body.reason.trim().length < 10) {
    return { ok: false, error: "reason deve essere almeno 10 caratteri" };
  }
  return { ok: true, ticketIds: body.ticketIds as string[], reason: body.reason.trim() };
}

// allowedVenue: (venueId) => true se il chiamante può agire su quel venue
export async function invalidateTickets({
  ticketIds,
  reason,
  isVenueAllowed,
}: {
  ticketIds: string[];
  reason: string;
  isVenueAllowed: (venue: { id: string; organizationId: string }) => boolean;
}): Promise<InvalidateResult> {
  const tickets = await db.ticket.findMany({
    where: { id: { in: ticketIds } },
    include: {
      venue: { select: { id: true, organizationId: true } },
      order: { include: { customer: { select: { email: true } } } },
    },
  });

  for (const ticket of tickets) {
    if (!isVenueAllowed(ticket.venue) || ticket.status !== "ACTIVE") {
      return { ok: false, status: 422, error: { code: "INVALID_TICKETS" } };
    }
  }
  if (tickets.length !== ticketIds.length) {
    return { ok: false, status: 422, error: { code: "INVALID_TICKETS" } };
  }

  const first = tickets[0];
  if (!first) {
    return { ok: false, status: 422, error: { code: "INVALID_TICKETS" } };
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status: "REFUNDED", refundedAt: now },
    });
  });

  const customerEmail = first.order?.customer?.email;
  if (customerEmail) {
    const count = ticketIds.length;
    const html = `<p>Abbiamo invalidato ${count} dei tuoi ticket.</p><p>Motivazione: ${reason}</p><p>Per chiarimenti, contattaci.</p>`;
    void sendEmail({
      to: customerEmail,
      subject: "Alcuni tuoi ticket sono stati invalidati",
      html,
    }).catch(console.error);
  }

  return {
    ok: true,
    invalidated: ticketIds.length,
    venueId: first.venue.id,
    organizationId: first.venue.organizationId,
  };
}
