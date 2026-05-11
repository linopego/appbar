import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { logManagerAction } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  if (id === session.operatorId) {
    return NextResponse.json({ ok: false, error: "Non puoi disattivarti" }, { status: 403 });
  }

  const operator = await db.operator.findUnique({ where: { id } });
  if (!operator) {
    return NextResponse.json({ ok: false, error: "Operatore non trovato" }, { status: 404 });
  }
  if (operator.venueId !== session.venueId) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
  }

  const newActive = !operator.active;
  await db.operator.update({ where: { id }, data: { active: newActive } });

  await logManagerAction({
    operatorId: session.operatorId,
    action: newActive ? "OPERATOR_REACTIVATED" : "OPERATOR_DEACTIVATED",
    targetType: "Operator",
    targetId: id,
    payload: { name: operator.name, role: operator.role, active: newActive },
  });

  return NextResponse.json({ ok: true, data: { active: newActive } });
}
