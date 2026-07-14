import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  const operator = await db.operator.findUnique({ where: { id } });
  if (!operator) {
    return NextResponse.json({ ok: false, error: "Operatore non trovato" }, { status: 404 });
  }

  const newActive = !operator.active;
  await db.operator.update({ where: { id }, data: { active: newActive } });

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: newActive ? "OPERATOR_REACTIVATED" : "OPERATOR_DEACTIVATED",
    targetType: "Operator",
    targetId: id,
    payload: { name: operator.name, role: operator.role, venueId: operator.venueId, active: newActive },
  });

  return NextResponse.json({ ok: true, data: { active: newActive } });
}
