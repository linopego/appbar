import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { staffOperatorsListLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils/request";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(staffOperatorsListLimiter, ip);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Troppe richieste." } },
      { status: 429 }
    );
  }

  const venueSlug = req.nextUrl.searchParams.get("venueSlug");
  if (!venueSlug) {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_VENUE", message: "venueSlug obbligatorio." } },
      { status: 400 }
    );
  }

  const venue = await db.venue.findUnique({
    where: { slug: venueSlug },
    select: { id: true, active: true },
  });
  if (!venue || !venue.active) {
    return NextResponse.json(
      { ok: false, error: { code: "VENUE_NOT_FOUND", message: "Venue non trovato." } },
      { status: 404 }
    );
  }

  const operators = await db.operator.findMany({
    where: { venueId: venue.id, active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, operators });
}
