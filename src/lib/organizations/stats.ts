import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// KPI per organizzazione: GMV (somma totalAmount degli ordini PAID) e fee
// piattaforma maturate (somma platformFeeAmount) in una finestra di giorni.
// Gli importi restano Decimal fino alla serializzazione (string nelle response).
// ─────────────────────────────────────────────────────────────────────────────

export interface OrgWindowStats {
  gmv: Prisma.Decimal;
  fees: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

export async function getOrgStats(
  organizationId: string,
  sinceDays: number,
  now: Date
): Promise<OrgWindowStats> {
  const since = new Date(now.getTime() - sinceDays * 86400000);
  const agg = await db.order.aggregate({
    where: {
      status: "PAID",
      createdAt: { gte: since },
      venue: { organizationId },
    },
    _sum: { totalAmount: true, platformFeeAmount: true },
  });
  return {
    gmv: agg._sum.totalAmount ?? ZERO,
    fees: agg._sum.platformFeeAmount ?? ZERO,
  };
}

// Statistiche 30gg per TUTTE le organizzazioni in due sole query:
// groupBy ordini per venue + mappa venue → organizzazione.
export async function getAllOrgStats30d(
  now: Date
): Promise<Map<string, OrgWindowStats>> {
  const since = new Date(now.getTime() - 30 * 86400000);

  const [venues, grouped] = await Promise.all([
    db.venue.findMany({ select: { id: true, organizationId: true } }),
    db.order.groupBy({
      by: ["venueId"],
      where: { status: "PAID", createdAt: { gte: since } },
      _sum: { totalAmount: true, platformFeeAmount: true },
    }),
  ]);

  const venueToOrg = new Map(venues.map((v) => [v.id, v.organizationId]));
  const byOrg = new Map<string, OrgWindowStats>();

  for (const row of grouped) {
    const orgId = venueToOrg.get(row.venueId);
    if (!orgId) continue;
    const current = byOrg.get(orgId) ?? { gmv: ZERO, fees: ZERO };
    byOrg.set(orgId, {
      gmv: current.gmv.add(row._sum.totalAmount ?? ZERO),
      fees: current.fees.add(row._sum.platformFeeAmount ?? ZERO),
    });
  }

  return byOrg;
}
