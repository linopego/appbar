import type { Ticket } from "@prisma/client";

export type EffectiveTicketStatus = "ACTIVE" | "CONSUMED" | "EXPIRED" | "REFUNDED" | "VOIDED";

export function computeTicketStatus(
  ticket: Pick<Ticket, "status" | "expiresAt">
): EffectiveTicketStatus {
  if (ticket.status === "CONSUMED") return "CONSUMED";
  if (ticket.status === "REFUNDED") return "REFUNDED";
  // Annullato per cancellazione account (diritto all'oblio): mai utilizzabile
  if (ticket.status === "VOIDED") return "VOIDED";
  if (ticket.expiresAt < new Date()) return "EXPIRED";
  return "ACTIVE";
}

export function isTicketUsable(
  ticket: Pick<Ticket, "status" | "expiresAt">
): boolean {
  return computeTicketStatus(ticket) === "ACTIVE";
}
