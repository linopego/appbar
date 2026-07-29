import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
import { buildOrdersCsv, ordersExportWhere } from "@/lib/orders/export-csv";

// Export CSV degli ordini lato superadmin: stessi filtri del percorso
// responsabile (lib condivisa) + venueId opzionale, scopato per
// organizzazione; colonna Venue in più (export cross-venue).
export async function GET(req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const url = new URL(req.url);
  const venueId = url.searchParams.get("venueId");

  const where = {
    ...ordersExportWhere(url.searchParams),
    ...orgScopeWhere(session).byVenue,
    ...(venueId ? { venueId } : {}),
  };

  const orders = await db.order.findMany({
    where,
    include: {
      customer: { select: { email: true } },
      venue: { select: { name: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  return new NextResponse(buildOrdersCsv(orders, true), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-export.csv"`,
    },
  });
}
