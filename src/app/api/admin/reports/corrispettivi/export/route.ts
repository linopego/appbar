import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import {
  buildCorrispettiviCsv,
  getCorrispettivi,
  parseReportDays,
  rangeInTimezone,
} from "@/lib/reports/corrispettivi";

// Export CSV del report corrispettivi del venue del manager:
// una riga per fascia + totali, per entrambe le viste (VENDUTO e CONSUMATO).
export async function GET(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const url = new URL(req.url);
  const { da, a } = parseReportDays(
    url.searchParams.get("da") ?? undefined,
    url.searchParams.get("a") ?? undefined,
    new Date()
  );

  const report = await getCorrispettivi(session.venueId, rangeInTimezone(da, a));
  const csv = buildCorrispettiviCsv(report);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="corrispettivi-${da}_${a}.csv"`,
    },
  });
}
