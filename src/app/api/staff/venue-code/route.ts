import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit, venueCodeLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils/request";

const bodySchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Inserisci il codice del locale")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Codice non valido."),
});

// Risposta IDENTICA per slug inesistente e venue disattivato: nessun oracolo
// sull'esistenza dei locali (l'elenco dei clienti della piattaforma non è
// pubblico).
function invalidCode() {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_CODE", message: "Codice non valido." } },
    { status: 404 }
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(venueCodeLimiter, ip);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Troppi tentativi. Riprova tra qualche minuto." } },
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CODE", message: "Codice non valido." } },
      { status: 400 }
    );
  }

  const venue = await db.venue.findUnique({
    where: { slug: parsed.data.code },
    select: { slug: true, active: true },
  });

  if (!venue || !venue.active) {
    return invalidCode();
  }

  return NextResponse.json({ ok: true, data: { slug: venue.slug } });
}
