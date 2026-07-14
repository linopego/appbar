import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
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

  // ORG_ADMIN: può gestire solo admin della propria organizzazione
  // (gli admin PLATFORM hanno organizationId null e restano quindi fuori scope)
  const user = await db.adminUser.findFirst({ where: { id, ...orgScopeWhere(session).adminUser } });
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
    organizationId: user.organizationId ?? undefined,
    action: "ADMIN_USER_PASSWORD_RESET",
    targetType: "AdminUser",
    targetId: id,
    payload: { email: user.email },
  });

  return NextResponse.json({ ok: true, data: { tempPassword } });
}
