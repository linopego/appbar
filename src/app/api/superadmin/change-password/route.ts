import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";
import { adminPasswordChangeSchema } from "@/lib/validators/auth-admin";
import { getClientIp, getUserAgent } from "@/lib/utils/request";
import { logAdminAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED_ADMIN", message: "Non autenticato." } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_BODY", message: "Richiesta non valida." } },
      { status: 400 }
    );
  }

  const parsed = adminPasswordChangeSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dati non validi.";
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message } },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  const adminUser = await db.adminUser.findUnique({
    where: { id: session.adminUserId },
  });
  if (!adminUser || !adminUser.active) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED_ADMIN", message: "Non autenticato." } },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(currentPassword, adminUser.passwordHash);
  if (!valid) {
    await logAdminAction({
      adminUserId: adminUser.id,
      action: "PASSWORD_CHANGE_FAILED",
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_CURRENT_PASSWORD", message: "Password attuale non corretta." },
      },
      { status: 401 }
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SAME_PASSWORD",
          message: "La nuova password deve essere diversa dalla precedente.",
        },
      },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.adminUser.update({
    where: { id: adminUser.id },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  await logAdminAction({
    adminUserId: adminUser.id,
    action: "PASSWORD_CHANGED",
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
