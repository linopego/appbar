import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  createAdminPendingSession,
  destroyAdminSession,
} from "@/lib/auth/admin";
import { adminCredentialsSchema } from "@/lib/validators/auth-admin";
import { adminLoginLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getClientIp, getUserAgent } from "@/lib/utils/request";
import { logAdminAction } from "@/lib/audit";
import { generateTotpSecret, getOtpauthUrl, generateQrDataUrl } from "@/lib/auth/totp";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const rl = await checkRateLimit(adminLoginLimiter, ip);
  if (!rl.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "RATE_LIMITED", message: "Troppi tentativi. Riprova più tardi." },
      },
      { status: 429 }
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

  const parsed = adminCredentialsSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dati non validi.";
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message } },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const adminUser = await db.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!adminUser || !adminUser.active) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Credenziali non valide." } },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, adminUser.passwordHash);
  if (!valid) {
    await logAdminAction({
      adminUserId: adminUser.id,
      action: "LOGIN_PASSWORD_FAILED",
      ipAddress: ip,
      userAgent,
    });
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Credenziali non valide." } },
      { status: 401 }
    );
  }

  // Garantisce che eventuali sessioni admin precedenti vengano invalidate ora che
  // siamo in mid-flow (verrà creata una nuova sessione solo dopo il TOTP).
  await destroyAdminSession();

  if (!adminUser.totpEnabled) {
    // Setup TOTP iniziale: rigenero il secret e lo salvo (non era confermato).
    const totpSecret = generateTotpSecret();
    await db.adminUser.update({
      where: { id: adminUser.id },
      data: { totpSecret },
    });

    const otpauthUrl = getOtpauthUrl(totpSecret, adminUser.email);
    const qrDataUrl = await generateQrDataUrl(otpauthUrl);

    await createAdminPendingSession(adminUser.id, "TOTP_SETUP_REQUIRED");

    return NextResponse.json({
      ok: true,
      requiresTotpSetup: true,
      otpauthUrl,
      qrDataUrl,
    });
  }

  await createAdminPendingSession(adminUser.id, "TOTP_REQUIRED");

  return NextResponse.json({
    ok: true,
    requiresTotp: true,
  });
}
