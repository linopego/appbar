import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { logAdminAction } from "@/lib/audit";
import { invalidateTickets, validateInvalidateInput } from "@/lib/tickets/invalidate";

// Invalidazione manuale lato superadmin: stessa logica condivisa del percorso
// responsabile; ORG_ADMIN può agire solo su ticket di venue della propria
// organizzazione (un ticket fuori scope invalida TUTTA la richiesta).
export async function POST(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  let body: { ticketIds?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const parsed = validateInvalidateInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const scope = orgScopeWhere(session);
  const result = await invalidateTickets({
    ticketIds: parsed.ticketIds,
    reason: parsed.reason,
    isVenueAllowed: (venue) =>
      scope.isPlatform || venue.organizationId === scope.organizationId,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: result.organizationId,
    action: "TICKETS_INVALIDATED",
    targetType: "Ticket",
    payload: { ticketIds: parsed.ticketIds, reason: parsed.reason, count: parsed.ticketIds.length },
  });

  return NextResponse.json({ ok: true, data: { invalidated: result.invalidated } });
}
