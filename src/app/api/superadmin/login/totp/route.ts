import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  createAdminSession,
  destroyAdminPendingSession,
  getAdminPendingSession,
} from "@/lib/auth/admin";
import { adminTotpSchema } from "@/lib/validators/auth-admin";
import { verifyTotpCode } from "@/lib/auth/totp";
import { getClientIp, getUserAgent } from "@/lib/utils/request";
import { logAdminAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const pending = await getAdminPendingSession();
  if (!pending || pending.step !== "TOTP_REQUIRED") {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "NO_PENDING_LOGIN", message: "Sessione di login scaduta. Riprova." },
      },
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

  const parsed = adminTotpSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Codice non valido.";
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message } },
      { status: 400 }
    );
  }

  const adminUser = await db.adminUser.findUnique({
    where: { id: pending.adminUserId },
  });
  if (!adminUser || !adminUser.active || !adminUser.totpEnabled || !adminUser.totpSecret) {
    return NextResponse.json(
      { ok: false, error: { code: "TOTP_NOT_ENABLED", message: "2FA non configurato." } },
      { status: 400 }
    );
  }

  const valid = verifyTotpCode(adminUser.totpSecret, parsed.data.code);
  if (!valid) {
    await logAdminAction({
      adminUserId: adminUser.id,
      action: "LOGIN_FAILED",
      payload: { reason: "totp_invalid" },
      ipAddress: ip,
      userAgent,
    });
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CODE", message: "Codice non valido." } },
      { status: 401 }
    );
  }

  await db.adminUser.update({
    where: { id: adminUser.id },
    data: { lastLoginAt: new Date() },
  });

  await destroyAdminPendingSession();
  await createAdminSession({
    adminUserId: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
  });

  await logAdminAction({
    adminUserId: adminUser.id,
    action: "LOGIN_SUCCESS",
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    redirectTo: adminUser.mustChangePassword ? "/superadmin/cambio-password" : "/superadmin",
  });
}
