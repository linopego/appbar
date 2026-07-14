import type { AdminSessionPayload } from "./admin";

// ─────────────────────────────────────────────────────────────────────────────
// Scoping per organizzazione degli endpoint e delle pagine /superadmin.
//
// PLATFORM  → nessun filtro (vede tutto, come lo storico super-admin)
// ORG_ADMIN → solo i dati della propria organizzazione
//
// I filtri sono frammenti `where` Prisma da spargere nelle query; ogni modello
// raggiunge l'organizzazione per la strada più corta:
//   Venue                    → organizationId diretto
//   Order / Ticket / Operator → venue.organizationId
//   Refund                   → order.venue.organizationId
//   AdminAuditLog            → organizationId denormalizzato (le righe storiche
//                              precedenti alla migrazione hanno null e restano
//                              visibili solo a PLATFORM)
//   AdminUser / Organization → organizationId / id
// ─────────────────────────────────────────────────────────────────────────────

type ScopeSession = Pick<AdminSessionPayload, "role" | "organizationId">;

export interface OrgScope {
  /** true se la sessione vede tutto (PLATFORM) */
  isPlatform: boolean;
  /** organizationId della sessione, null per PLATFORM */
  organizationId: string | null;
  /** Venue: { organizationId } */
  venue: Record<string, unknown>;
  /** Order, Ticket, Operator: { venue: { organizationId } } */
  byVenue: Record<string, unknown>;
  /** Refund: { order: { venue: { organizationId } } } */
  byOrder: Record<string, unknown>;
  /** AdminAuditLog: { organizationId } */
  audit: Record<string, unknown>;
  /** AdminUser: { organizationId } */
  adminUser: Record<string, unknown>;
  /** Organization: { id } */
  organization: Record<string, unknown>;
}

export function orgScopeWhere(session: ScopeSession): OrgScope {
  if (session.role === "PLATFORM") {
    return {
      isPlatform: true,
      organizationId: null,
      venue: {},
      byVenue: {},
      byOrder: {},
      audit: {},
      adminUser: {},
      organization: {},
    };
  }

  // ORG_ADMIN senza organizationId non dovrebbe esistere (regola di integrità
  // applicativa): per sicurezza il filtro usa un id impossibile, così una
  // sessione malformata non vede nulla invece di vedere tutto.
  const orgId = session.organizationId ?? "__nessuna_organizzazione__";

  return {
    isPlatform: false,
    organizationId: orgId,
    venue: { organizationId: orgId },
    byVenue: { venue: { organizationId: orgId } },
    byOrder: { order: { venue: { organizationId: orgId } } },
    audit: { organizationId: orgId },
    adminUser: { organizationId: orgId },
    organization: { id: orgId },
  };
}
