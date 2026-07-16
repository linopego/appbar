import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
import {
  buildCorrispettiviCsv,
  getCorrispettivi,
  parseReportDays,
  rangeInTimezone,
} from "@/lib/reports/corrispettivi";

// Export CSV del report corrispettivi (superadmin, scopato per organizzazione):
// una riga per fascia + totali, per entrambe le viste (VENDUTO e CONSUMATO).
export async function GET(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const url = new URL(req.url);
  const venueId = url.searchParams.get("venueId");
  if (!venueId) {
    return NextResponse.json({ ok: false, error: "venueId è obbligatorio" }, { status: 400 });
  }

  // Scoping: un venue fuori dall'organizzazione dell'ORG_ADMIN non esiste (404)
  const scope = orgScopeWhere(session);
  const venue = await db.venue.findFirst({
    where: { id: venueId, ...scope.venue },
    select: { id: true, slug: true },
  });
  if (!venue) {
    return NextResponse.json({ ok: false, error: "Venue non trovato" }, { status: 404 });
  }

  const { da, a } = parseReportDays(
    url.searchParams.get("da") ?? undefined,
    url.searchParams.get("a") ?? undefined,
    new Date()
  );

  const report = await getCorrispettivi(venue.id, rangeInTimezone(da, a));
  const csv = buildCorrispettiviCsv(report);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="corrispettivi-${venue.slug}-${da}_${a}.csv"`,
    },
  });
}
