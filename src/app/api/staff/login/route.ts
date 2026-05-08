import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createStaffSession } from "@/lib/auth/staff";
import { staffLoginSchema } from "@/lib/validators/auth-staff";
import { staffLoginLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils/request";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(staffLoginLimiter, ip);
  if (!rl.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "RATE_LIMITED", message: "Troppi tentativi. Riprova tra qualche minuto." },
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

  const parsed = staffLoginSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dati non validi.";
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message } },
      { status: 400 }
    );
  }

  const { venueSlug, operatorId, pin } = parsed.data;

  const venue = await db.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue || !venue.active) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Credenziali non valide." } },
      { status: 401 }
    );
  }

  const operator = await db.operator.findFirst({
    where: { id: operatorId, venueId: venue.id, active: true },
  });
  if (!operator) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Credenziali non valide." } },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(pin, operator.pinHash);
  if (!valid) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Credenziali non valide." } },
      { status: 401 }
    );
  }

  await db.operator.update({
    where: { id: operator.id },
    data: { lastLoginAt: new Date() },
  });

  await createStaffSession({
    operatorId: operator.id,
    venueId: venue.id,
    venueSlug: venue.slug,
    role: operator.role,
    name: operator.name,
  });

  return NextResponse.json({
    ok: true,
    redirectTo: `/staff/${venue.slug}/pos`,
  });
}
