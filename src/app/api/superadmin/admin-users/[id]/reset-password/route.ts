import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  if (id === session.adminUserId) {
    return NextResponse.json(
      { ok: false, error: { code: "CANNOT_RESET_OWN_PASSWORD" } },
      { status: 422 }
    );
  }

  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Utente non trovato" }, { status: 404 });
  }

  const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await db.adminUser.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: "ADMIN_USER_PASSWORD_RESET",
    targetType: "AdminUser",
    targetId: id,
    payload: { email: user.email },
  });

  return NextResponse.json({ ok: true, data: { tempPassword } });
}
