import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import { formatEur } from "@/lib/utils/money";
import { StaffLogoutButton } from "../pos/staff-logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats POS — Sistema Ticket" };

interface PageProps {
  params: Promise<{ venueSlug: string }>;
}

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);

export default async function StatsPage({ params }: PageProps) {
  const { venueSlug } = await params;

  const session = await requireStaff().catch(() => null);
  if (!session) redirect(`/staff/${venueSlug}`);
  if (session.venueSlug !== venueSlug) redirect(`/staff/${session.venueSlug}/stats`);

  const today = new Date();

  const [venue, stats] = await Promise.all([
    db.venue.findUnique({ where: { slug: venueSlug }, select: { id: true, name: true } }),
    db.ticket.groupBy({
      by: ["priceTierId"],
      where: {
        venueId: session.venueId,
        status: "CONSUMED",
        consumedAt: { gte: startOfDay(today), lte: endOfDay(today) },
      },
      _count: { id: true },
    }),
  ]);

  if (!venue) redirect("/");

  const tiers = await db.priceTier.findMany({
    where: { venueId: venue.id },
    select: { id: true, name: true, price: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const tierMap = new Map(tiers.map((t) => [t.id, t]));

  const rows = stats
    .map((s) => {
      const tier = tierMap.get(s.priceTierId);
      if (!tier) return null;
      const count = s._count.id;
      return { tier, count, total: tier.price.toNumber() * count };
    })
    .filter(Boolean)
    .sort((a, b) => a!.tier.sortOrder - b!.tier.sortOrder) as Array<{
    tier: { id: string; name: string; price: { toNumber(): number }; sortOrder: number };
    count: number;
    total: number;
  }>;

  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <main className="dark min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-400">Statistiche di oggi</p>
            <h1 className="text-2xl font-semibold">{venue.name}</h1>
            <p className="text-sm text-zinc-400 mt-0.5">{formatDate(today)}</p>
          </div>
          <StaffLogoutButton venueSlug={venueSlug} />
        </div>

        <p className="text-sm text-zinc-400">Operatore: {session.name}</p>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessun ticket consegnato oggi.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Fascia</th>
                  <th className="text-right px-4 py-3">Q.tà</th>
                  <th className="text-right px-4 py-3">Prezzo unit.</th>
                  <th className="text-right px-4 py-3">Totale fascia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.tier.id} className="border-b border-zinc-800/50">
                    <td className="px-4 py-3 font-medium">{r.tier.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatEur(r.tier.price.toNumber())}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatEur(r.total)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-600 font-bold">
                  <td className="px-4 py-3">TOTALE</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totalCount}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right tabular-nums">{formatEur(totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <Link
          href={`/staff/${venueSlug}/pos`}
          className="inline-block text-sm underline text-zinc-400 hover:text-zinc-200"
        >
          ← Torna al POS
        </Link>
      </div>
    </main>
  );
}
