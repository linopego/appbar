import { db } from "@/lib/db";

// Statistiche venue (per giorno / per fascia / per operatore), condivise tra
// la pagina del responsabile (/admin/statistiche) e quella superadmin
// (/superadmin/statistiche): stesse query, un solo posto.

export interface DailyStatsRow {
  date: string; // YYYY-MM-DD
  sold: number;
  consumed: number;
}

export interface TierStatsRow {
  tierId: string;
  tierName: string;
  price: string;
  sold: number;
  consumed: number;
  revenue: string;
}

export interface OperatorStatsRow {
  operatorId: string;
  operatorName: string;
  role: string;
  consumed: number;
}

export interface StatsRange {
  from: Date;
  to: Date;
}

export function parseStatsRange(
  fromParam: string | undefined,
  toParam: string | undefined,
  now: Date
): { from: string; to: string; range: StatsRange } {
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
  const from = fromParam ?? defaultFrom;
  const to = toParam ?? defaultTo;
  return {
    from,
    to,
    range: { from: new Date(from + "T00:00:00"), to: new Date(to + "T23:59:59") },
  };
}

export async function getDailyStats(venueId: string, range: StatsRange): Promise<DailyStatsRow[]> {
  const tickets = await db.ticket.findMany({
    where: { venueId, createdAt: { gte: range.from, lte: range.to } },
    select: { createdAt: true, consumedAt: true, status: true },
  });

  const soldMap = new Map<string, number>();
  const consumedMap = new Map<string, number>();
  for (const t of tickets) {
    const d = t.createdAt.toISOString().slice(0, 10);
    soldMap.set(d, (soldMap.get(d) ?? 0) + 1);
    if (t.consumedAt) {
      const dc = t.consumedAt.toISOString().slice(0, 10);
      consumedMap.set(dc, (consumedMap.get(dc) ?? 0) + 1);
    }
  }

  const dates = new Set([...soldMap.keys(), ...consumedMap.keys()]);
  return Array.from(dates)
    .sort()
    .map((d) => ({ date: d, sold: soldMap.get(d) ?? 0, consumed: consumedMap.get(d) ?? 0 }));
}

export async function getTierStats(venueId: string, range: StatsRange): Promise<TierStatsRow[]> {
  const [soldGroups, consumedGroups, tiers] = await Promise.all([
    db.ticket.groupBy({
      by: ["priceTierId"],
      where: { venueId, createdAt: { gte: range.from, lte: range.to } },
      _count: { id: true },
    }),
    db.ticket.groupBy({
      by: ["priceTierId"],
      where: { venueId, status: "CONSUMED", consumedAt: { gte: range.from, lte: range.to } },
      _count: { id: true },
    }),
    db.priceTier.findMany({ where: { venueId }, select: { id: true, name: true, price: true } }),
  ]);

  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const consumedMap = new Map(consumedGroups.map((g) => [g.priceTierId, g._count.id]));

  return soldGroups
    .map((g) => {
      const tier = tierMap.get(g.priceTierId);
      const sold = g._count.id;
      const consumed = consumedMap.get(g.priceTierId) ?? 0;
      const revenue = (sold * Number(tier?.price ?? 0)).toFixed(2);
      return {
        tierId: g.priceTierId,
        tierName: tier?.name ?? "?",
        price: tier?.price.toString() ?? "0",
        sold,
        consumed,
        revenue,
      };
    })
    .sort((a, b) => b.sold - a.sold);
}

export async function getOperatorStats(
  venueId: string,
  range: StatsRange
): Promise<OperatorStatsRow[]> {
  const [operators, consumedGroups] = await Promise.all([
    db.operator.findMany({
      where: { venueId, role: { in: ["BARISTA", "CASSIERE"] } },
      select: { id: true, name: true, role: true },
    }),
    db.ticket.groupBy({
      by: ["consumedBy"],
      where: {
        venueId,
        status: "CONSUMED",
        consumedAt: { gte: range.from, lte: range.to },
        consumedBy: { not: null },
      },
      _count: { id: true },
    }),
  ]);

  const consumedMap = new Map(consumedGroups.map((g) => [g.consumedBy!, g._count.id]));

  return operators
    .map((op) => ({
      operatorId: op.id,
      operatorName: op.name,
      role: op.role,
      consumed: consumedMap.get(op.id) ?? 0,
    }))
    .sort((a, b) => b.consumed - a.consumed);
}
