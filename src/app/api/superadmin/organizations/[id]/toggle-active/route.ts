import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";

// Disattivare un'organizzazione blocca il checkout dei suoi venue (503),
// ma POS e rimborsi continuano a funzionare: i ticket già venduti restano
// validi. Nessuna eliminazione: FK e storico fiscale non si toccano.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autenticato" }, { status: 401 });
  if (session.role !== "PLATFORM") {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await params;
  const organization = await db.organization.findUnique({ where: { id } });
  if (!organization) {
    return NextResponse.json({ ok: false, error: "Organizzazione non trovata" }, { status: 404 });
  }

  const newActive = !organization.active;
  await db.organization.update({ where: { id }, data: { active: newActive } });

  await logAdminAction({
    adminUserId: session.adminUserId,
    organizationId: id,
    action: newActive ? "ORG_ACTIVATED" : "ORG_DEACTIVATED",
    targetType: "Organization",
    targetId: id,
    payload: { before: { active: organization.active }, after: { active: newActive } },
  });

  return NextResponse.json({ ok: true, data: { active: newActive } });
}
