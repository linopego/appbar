import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import { requireStaff, StaffAuthError } from "@/lib/auth/staff";
import { db } from "@/lib/db";

export async function GET() {
  let session;
  try {
    session = await requireStaff();
  } catch (err) {
    const code = err instanceof StaffAuthError ? err.message : "UNAUTHORIZED_STAFF";
    return NextResponse.json({ ok: false, error: { code } }, { status: 401 });
  }

  const today = new Date();

  const [stats, tierMap] = await Promise.all([
    db.ticket.groupBy({
      by: ["priceTierId"],
      where: {
        venueId: session.venueId,
        status: "CONSUMED",
        consumedAt: { gte: startOfDay(today), lte: endOfDay(today) },
      },
      _count: { id: true },
    }),
    db.priceTier
      .findMany({
        where: { venueId: session.venueId },
        select: { id: true, name: true, price: true, sortOrder: true },
      })
      .then((tiers) => new Map(tiers.map((t) => [t.id, t]))),
  ]);

  const byTier = stats
    .map((s) => {
      const tier = tierMap.get(s.priceTierId);
      if (!tier) return null;
      const count = s._count.id;
      return {
        tierId: tier.id,
        tierName: tier.name,
        price: tier.price.toString(),
        sortOrder: tier.sortOrder,
        count,
        total: (tier.price.toNumber() * count).toFixed(2),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.sortOrder - b!.sortOrder) as Array<{
    tierId: string;
    tierName: string;
    price: string;
    count: number;
    total: string;
  }>;

  const totalCount = byTier.reduce((sum, r) => sum + r.count, 0);
  const totalAmount = byTier.reduce((sum, r) => sum + Number(r.total), 0).toFixed(2);

  const venue = await db.venue.findUnique({
    where: { id: session.venueId },
    select: { name: true },
  });

  return NextResponse.json({
    ok: true,
    data: {
      operatorName: session.name,
      venueName: venue?.name ?? session.venueSlug,
      date: today.toISOString().slice(0, 10),
      byTier,
      totalCount,
      totalAmount,
    },
  });
}
