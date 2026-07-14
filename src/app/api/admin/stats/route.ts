import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";

function parseDateRange(fromParam: string | null, toParam: string | null): { from: Date; to: Date } {
  const to = toParam ? new Date(toParam) : new Date();
  if (toParam && !isNaN(to.getTime())) {
    to.setHours(23, 59, 59, 999);
  } else {
    to.setHours(23, 59, 59, 999);
  }

  let from: Date;
  if (fromParam) {
    from = new Date(fromParam);
    if (isNaN(from.getTime())) {
      from = new Date();
      from.setDate(from.getDate() - 30);
    }
    from.setHours(0, 0, 0, 0);
  } else {
    from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
  }

  return { from, to };
}

function toDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function GET(req: NextRequest) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "daily";
  const { from, to } = parseDateRange(url.searchParams.get("from"), url.searchParams.get("to"));

  if (type === "daily") {
    const [soldTickets, consumedTickets] = await Promise.all([
      db.ticket.findMany({
        where: {
          venueId: session.venueId,
          createdAt: { gte: from, lte: to },
        },
        select: { createdAt: true, priceTier: { select: { price: true } } },
      }),
      db.ticket.findMany({
        where: {
          venueId: session.venueId,
          consumedAt: { gte: from, lte: to },
          status: "CONSUMED",
        },
        select: { consumedAt: true },
      }),
    ]);

    const dailyMap = new Map<string, { sold: number; consumed: number; revenue: number }>();

    for (const t of soldTickets) {
      const key = toDateString(t.createdAt);
      const entry = dailyMap.get(key) ?? { sold: 0, consumed: 0, revenue: 0 };
      entry.sold += 1;
      entry.revenue += Number(t.priceTier.price);
      dailyMap.set(key, entry);
    }
    for (const t of consumedTickets) {
      if (!t.consumedAt) continue;
      const key = toDateString(t.consumedAt);
      const entry = dailyMap.get(key) ?? { sold: 0, consumed: 0, revenue: 0 };
      entry.consumed += 1;
      dailyMap.set(key, entry);
    }

    const rows = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        sold: data.sold,
        consumed: data.consumed,
        revenue: data.revenue.toFixed(2),
      }));

    return NextResponse.json({ ok: true, data: { rows } });
  }

  if (type === "tier") {
    const [soldGroups, consumedGroups, priceTiers] = await Promise.all([
      db.ticket.groupBy({
        by: ["priceTierId"],
        where: {
          venueId: session.venueId,
          createdAt: { gte: from, lte: to },
        },
        _count: { id: true },
      }),
      db.ticket.groupBy({
        by: ["priceTierId"],
        where: {
          venueId: session.venueId,
          status: "CONSUMED",
          consumedAt: { gte: from, lte: to },
        },
        _count: { id: true },
      }),
      db.priceTier.findMany({
        where: { venueId: session.venueId },
        select: { id: true, name: true, price: true },
      }),
    ]);

    const soldMap = new Map(soldGroups.map((g) => [g.priceTierId, g._count.id]));
    const consumedMap = new Map(consumedGroups.map((g) => [g.priceTierId, g._count.id]));
    const rows = priceTiers.map((tier) => {
      const sold = soldMap.get(tier.id) ?? 0;
      const consumed = consumedMap.get(tier.id) ?? 0;
      const revenue = (sold * Number(tier.price)).toFixed(2);
      return {
        tierId: tier.id,
        tierName: tier.name,
        price: tier.price.toString(),
        sold,
        consumed,
        revenue,
      };
    });

    return NextResponse.json({ ok: true, data: { rows } });
  }

  if (type === "operator") {
    const operators = await db.operator.findMany({
      where: {
        venueId: session.venueId,
        role: { in: ["BARISTA", "CASSIERE"] },
      },
      select: { id: true, name: true, role: true },
    });

    const consumedGroups = await db.ticket.groupBy({
      by: ["consumedBy"],
      where: {
        venueId: session.venueId,
        status: "CONSUMED",
        consumedAt: { gte: from, lte: to },
        consumedBy: { in: operators.map((o) => o.id) },
      },
      _count: { id: true },
    });

    const consumedMap = new Map(consumedGroups.map((g) => [g.consumedBy, g._count.id]));

    const rows = operators.map((op) => ({
      operatorId: op.id,
      operatorName: op.name,
      role: op.role,
      consumed: consumedMap.get(op.id) ?? 0,
    }));

    return NextResponse.json({ ok: true, data: { rows } });
  }

  return NextResponse.json({ ok: false, error: "type non valido" }, { status: 400 });
}
