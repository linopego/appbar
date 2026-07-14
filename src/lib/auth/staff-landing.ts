import type { OperatorRole } from "@prisma/client";

// Landing dopo il login staff: i manager atterrano sul pannello, chi lavora
// al banco (barista/cassiere) va dritto al POS.
export function staffLandingPath(role: OperatorRole, venueSlug: string): string {
  return role === "MANAGER" ? "/admin" : `/staff/${venueSlug}/pos`;
}
