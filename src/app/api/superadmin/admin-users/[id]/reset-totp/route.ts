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

  if (id === session.adminUserId) {
    return NextResponse.json(
      { ok: false, error: { code: "CANNOT_RESET_OWN_TOTP" } },
      { status: 422 }
    );
  }

  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Utente non trovato" }, { status: 404 });
  }

  await db.adminUser.update({
    where: { id },
    data: { totpEnabled: false, totpSecret: null },
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: "ADMIN_USER_TOTP_RESET",
    targetType: "AdminUser",
    targetId: id,
    payload: { email: user.email },
  });

  return NextResponse.json({ ok: true });
}
