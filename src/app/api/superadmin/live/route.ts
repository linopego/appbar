import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
import { getLiveSnapshot } from "@/lib/reports/live-data";

export const dynamic = "force-dynamic";

// Snapshot "Serata live" per il superadmin, scopato per organizzazione:
// un venueId fuori dallo scope dell'ORG_ADMIN non esiste (404).
export async function GET(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const venueId = new URL(req.url).searchParams.get("venueId");
  if (!venueId) {
    return NextResponse.json({ ok: false, error: "venueId è obbligatorio" }, { status: 400 });
  }

  const scope = orgScopeWhere(session);
  const venue = await db.venue.findFirst({
    where: { id: venueId, ...scope.venue },
    select: { id: true },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovato" }, { status: 404 });
  }

  const snapshot = await getLiveSnapshot(venue.id, new Date());
  return NextResponse.json({ ok: true, data: snapshot });
}
