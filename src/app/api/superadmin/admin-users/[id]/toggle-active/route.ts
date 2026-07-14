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

  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Utente non trovato" }, { status: 404 });
  }

  const newActive = !user.active;

  if (!newActive) {
    if (id === session.adminUserId) {
      return NextResponse.json(
        { ok: false, error: { code: "CANNOT_DEACTIVATE_SELF" } },
        { status: 422 }
      );
    }
    const otherActiveAdmins = await db.adminUser.count({
      where: { active: true, id: { not: id } },
    });
    if (otherActiveAdmins === 0) {
      return NextResponse.json(
        { ok: false, error: { code: "CANNOT_DEACTIVATE_LAST_ADMIN" } },
        { status: 422 }
      );
    }
  }

  await db.adminUser.update({ where: { id }, data: { active: newActive } });

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: newActive ? "ADMIN_USER_REACTIVATED" : "ADMIN_USER_DEACTIVATED",
    targetType: "AdminUser",
    targetId: id,
    payload: { email: user.email, active: newActive },
  });

  return NextResponse.json({ ok: true, data: { active: newActive } });
}
