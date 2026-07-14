import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createStaffSession } from "@/lib/auth/staff";
import { checkRateLimit, staffManagerLoginLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils/request";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Credenziali non valide."),
  password: z.string().min(1, "Credenziali non valide."),
});

// Errore SEMPRE identico: mai rivelare se l'email esiste, se ha una password
// impostata, se l'operatore è disattivato o se il ruolo non è MANAGER.
function invalidCredentials() {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Credenziali non valide." } },
    { status: 401 }
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_BODY", message: "Richiesta non valida." } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return invalidCredentials();
  }
  const { email, password } = parsed.data;

  // Rate limit severo su IP+email: 5 tentativi / 15 minuti
  const ip = getClientIp(req);
  const rl = await checkRateLimit(staffManagerLoginLimiter, `${ip}:${email}`);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Troppi tentativi. Riprova tra qualche minuto." } },
      { status: 429 }
    );
  }

  const operator = await db.operator.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      role: "MANAGER",
      active: true,
    },
    include: { venue: { select: { id: true, slug: true, active: true } } },
  });

  if (!operator || !operator.passwordHash || !operator.venue.active) {
    return invalidCredentials();
  }

  const valid = await bcrypt.compare(password, operator.passwordHash);
  if (!valid) {
    return invalidCredentials();
  }

  await db.operator.update({
    where: { id: operator.id },
    data: { lastLoginAt: new Date() },
  });

  // Stessa sessione staff del login PIN: il resto del sistema non cambia
  await createStaffSession({
    operatorId: operator.id,
    venueId: operator.venue.id,
    venueSlug: operator.venue.slug,
    role: operator.role,
    name: operator.name,
  });

  return NextResponse.json({
    ok: true,
    mustChangePassword: operator.mustChangePassword,
    redirectTo: operator.mustChangePassword ? "/admin/cambio-password" : "/admin",
  });
}
