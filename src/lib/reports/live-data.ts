import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { aggregateByTier } from "@/lib/reports/corrispettivi";
import {
  hourlyBuckets,
  mergeTierAggregates,
  operationalDayRange,
  OPERATIONAL_TIMEZONE,
  type HourBucket,
  type LiveTierRow,
} from "@/lib/reports/operational-day";

// Snapshot della "Serata live" per un venue: KPI, fasce, andamento orario e
// feed eventi della giornata OPERATIVA (06→06 Europe/Rome). Query aggregate
// (groupBy/aggregate) + una sola findMany sui ticket consumati della serata
// (serve comunque per l'istogramma orario e il feed): niente N+1.

// Lordo per data di pagamento, come nell'R15: un ordine poi rimborsato è
// comunque stato venduto stasera.
const SOLD_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

export interface LiveFeedEvent {
  at: string; // ISO
  time: string; // HH:MM locale (Europe/Rome)
  kind: "sale" | "consumption";
  text: string; // es. "Ordine 3× Birra" | "Birra consegnata"
  sub?: string; // es. nome operatore — MAI dati dei clienti
}

export interface LiveSnapshot {
  day: { key: string; startIso: string; endIso: string };
  kpi: {
    soldTotal: string; // EUR
    soldOrders: number;
    consumedCount: number;
    activeCirculating: number; // ticket ACTIVE non scaduti (totale venue)
  };
  tiers: LiveTierRow[];
  hourly: HourBucket[];
  feed: LiveFeedEvent[];
  generatedAt: string; // ISO
}

const timeFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: OPERATIONAL_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

function orderText(items: { tierName: string; quantity: number }[]): string {
  const summary = items.map((i) => `${i.quantity}× ${i.tierName}`).join(", ");
  return `Ordine ${summary || "—"}`;
}

export async function getLiveSnapshot(venueId: string, now: Date): Promise<LiveSnapshot> {
  const day = operationalDayRange(now);
  const soldOrderWhere = {
    venueId,
    status: { in: [...SOLD_STATUSES] },
    paidAt: { gte: day.start, lt: day.end },
  };

  const [orderAgg, soldByTier, consumedTickets, activeCirculating, recentOrders] =
    await Promise.all([
      db.order.aggregate({
        where: soldOrderWhere,
        _count: true,
        _sum: { totalAmount: true },
      }),
      db.orderItem.groupBy({
        by: ["tierName", "unitPrice"],
        where: { order: soldOrderWhere },
        _sum: { quantity: true },
      }),
      // Una findMany sola per: fasce consumate, istogramma orario e feed
      db.ticket.findMany({
        where: { venueId, consumedAt: { gte: day.start, lt: day.end } },
        select: {
          consumedAt: true,
          priceTierId: true,
          priceTier: { select: { name: true, price: true } },
          order: { select: { items: { select: { priceTierId: true, unitPrice: true } } } },
          operator: { select: { name: true } },
        },
        orderBy: { consumedAt: "desc" },
      }),
      db.ticket.count({
        where: { venueId, status: "ACTIVE", expiresAt: { gt: now } },
      }),
      db.order.findMany({
        where: soldOrderWhere,
        orderBy: { paidAt: "desc" },
        take: 10,
        select: { paidAt: true, items: { select: { tierName: true, quantity: true } } },
      }),
    ]);

  const sold = aggregateByTier(
    soldByTier.map((g) => ({
      tierName: g.tierName,
      quantity: g._sum.quantity ?? 0,
      unitPrice: g.unitPrice,
    }))
  );
  const consumed = aggregateByTier(
    consumedTickets.map((t) => ({
      tierName: t.priceTier.name,
      quantity: 1,
      // prezzo pagato (snapshot ordine), coerente con l'R15
      unitPrice:
        t.order.items.find((i) => i.priceTierId === t.priceTierId)?.unitPrice ??
        t.priceTier.price,
    }))
  );

  // Feed: ultime 10 righe tra vendite e consumi, senza dati dei clienti
  const saleEvents: LiveFeedEvent[] = recentOrders
    .filter((o) => o.paidAt !== null)
    .map((o) => ({
      at: (o.paidAt as Date).toISOString(),
      time: timeFmt.format(o.paidAt as Date),
      kind: "sale" as const,
      text: orderText(o.items),
    }));
  const consumptionEvents: LiveFeedEvent[] = consumedTickets.slice(0, 10).map((t) => ({
    at: (t.consumedAt as Date).toISOString(),
    time: timeFmt.format(t.consumedAt as Date),
    kind: "consumption" as const,
    text: `${t.priceTier.name} consegnato`,
    ...(t.operator?.name ? { sub: t.operator.name } : {}),
  }));
  const feed = [...saleEvents, ...consumptionEvents]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  return {
    day: { key: day.key, startIso: day.start.toISOString(), endIso: day.end.toISOString() },
    kpi: {
      soldTotal: (orderAgg._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
      soldOrders: orderAgg._count,
      consumedCount: consumedTickets.length,
      activeCirculating,
    },
    tiers: mergeTierAggregates(sold, consumed),
    hourly: hourlyBuckets(
      consumedTickets.map((t) => t.consumedAt as Date),
      OPERATIONAL_TIMEZONE
    ),
    feed,
    generatedAt: now.toISOString(),
  };
}
