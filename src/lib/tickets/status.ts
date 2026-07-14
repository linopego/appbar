import type { Ticket } from "@prisma/client";

export type EffectiveTicketStatus = "ACTIVE" | "CONSUMED" | "EXPIRED" | "REFUNDED";

export function computeTicketStatus(
  ticket: Pick<Ticket, "status" | "expiresAt">
): EffectiveTicketStatus {
  if (ticket.status === "CONSUMED") return "CONSUMED";
  if (ticket.status === "REFUNDED") return "REFUNDED";
  if (ticket.expiresAt < new Date()) return "EXPIRED";
  return "ACTIVE";
}

export function isTicketUsable(
  ticket: Pick<Ticket, "status" | "expiresAt">
): boolean {
  return computeTicketStatus(ticket) === "ACTIVE";
}
