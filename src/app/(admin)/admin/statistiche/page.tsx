import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { formatEur } from "@/lib/utils/money";
import { DailyBarChart, TierPieChart } from "./stats-charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statistiche — Admin" };

type TabType = "daily" | "tier" | "operator";

interface DailyRow { date: string; sold: number; consumed: number; revenue: string }
interface TierRow { tierId: string; tierName: string; price: string; sold: number; consumed: number; revenue: string }
interface OperatorRow { operatorId: string; operatorName: string; role: string; consumed: number }

const TABS: { type: TabType; label: string }[] = [
  { type: "daily", label: "Per giorno" },
  { type: "tier", label: "Per fascia" },
  { type: "operator", label: "Per operatore" },
];

const ROLE_LABELS: Record<string, string> = { BARISTA: "Barista", CASSIERE: "Cassiere" };

export default async function StatistichePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
}) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const sp = await searchParams;
  const type: TabType = (["daily", "tier", "operator"] as TabType[]).includes(sp.type as TabType) ? (sp.type as TabType) : "daily";

  // Default: last 30 days
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
  const from = sp.from ?? defaultFrom;
  const to = sp.to ?? defaultTo;

  const statsUrl = `/api/admin/stats?type=${type}&from=${from}&to=${to}`;

  // Fetch stats server-side
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  let dailyRows: DailyRow[] = [];
  let tierRows: TierRow[] = [];
  let operatorRows: OperatorRow[] = [];

  try {
    // We call the API internally by directly importing the logic
    // To avoid HTTP overhead, we use the same db queries inline
    const { db } = await import("@/lib/db");

    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59");

    if (type === "daily") {
      const tickets = await db.ticket.findMany({
        where: { venueId: session.venueId, createdAt: { gte: fromDate, lte: toDate } },
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
      dailyRows = Array.from(dates).sort().map((d) => ({
        date: d,
        sold: soldMap.get(d) ?? 0,
        consumed: consumedMap.get(d) ?? 0,
        revenue: "0",
      }));
    } else if (type === "tier") {
      const [soldGroups, consumedGroups, tiers] = await Promise.all([
        db.ticket.groupBy({
          by: ["priceTierId"],
          where: { venueId: session.venueId, createdAt: { gte: fromDate, lte: toDate } },
          _count: { id: true },
        }),
        db.ticket.groupBy({
          by: ["priceTierId"],
          where: { venueId: session.venueId, status: "CONSUMED", consumedAt: { gte: fromDate, lte: toDate } },
          _count: { id: true },
        }),
        db.priceTier.findMany({ where: { venueId: session.venueId }, select: { id: true, name: true, price: true } }),
      ]);

      const tierMap = new Map(tiers.map((t) => [t.id, t]));
      const consumedMap = new Map(consumedGroups.map((g) => [g.priceTierId, g._count.id]));

      tierRows = soldGroups.map((g) => {
        const tier = tierMap.get(g.priceTierId);
        const sold = g._count.id;
        const consumed = consumedMap.get(g.priceTierId) ?? 0;
        const revenue = (sold * Number(tier?.price ?? 0)).toFixed(2);
        return { tierId: g.priceTierId, tierName: tier?.name ?? "?", price: tier?.price.toString() ?? "0", sold, consumed, revenue };
      }).sort((a, b) => b.sold - a.sold);
    } else {
      const [operators, consumedGroups] = await Promise.all([
        db.operator.findMany({
          where: { venueId: session.venueId, role: { in: ["BARISTA", "CASSIERE"] } },
          select: { id: true, name: true, role: true },
        }),
        db.ticket.groupBy({
          by: ["consumedBy"],
          where: {
            venueId: session.venueId,
            status: "CONSUMED",
            consumedAt: { gte: fromDate, lte: toDate },
            consumedBy: { not: null },
          },
          _count: { id: true },
        }),
      ]);

      const consumedMap = new Map(consumedGroups.map((g) => [g.consumedBy!, g._count.id]));

      operatorRows = operators.map((op) => ({
        operatorId: op.id,
        operatorName: op.name,
        role: op.role,
        consumed: consumedMap.get(op.id) ?? 0,
      })).sort((a, b) => b.consumed - a.consumed);
    }
  } catch (e) {
    console.error("Stats error", e);
    void baseUrl;
    void statsUrl;
  }

  function qs(overrides: Record<string, string>) {
    const p = new URLSearchParams({ type, from, to, ...overrides });
    return `?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Statistiche</h1>
      </div>

      {/* Date range filters */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="type" value={type} />
        <div className="space-y-1">
          <label className="block text-xs text-zinc-500">Da</label>
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-500">A</label>
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors">Applica</button>
      </form>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {TABS.map((tab) => (
          <Link
            key={tab.type}
            href={`/admin/statistiche${qs({ type: tab.type })}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${type === tab.type ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {type === "daily" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <DailyBarChart data={dailyRows} />
          </div>

          <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-right px-4 py-3">Venduti</th>
                  <th className="text-right px-4 py-3">Consegnati</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-400">Nessun dato nel periodo</td></tr>
                )}
                {dailyRows.map((r) => (
                  <tr key={r.date} className="border-b border-zinc-50">
                    <td className="px-4 py-2 text-zinc-700">{r.date}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.sold}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.consumed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {type === "tier" && (
        <div className="space-y-6">
          {tierRows.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <TierPieChart data={tierRows} />
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Fascia</th>
                  <th className="text-right px-4 py-3">Venduti</th>
                  <th className="text-right px-4 py-3">Consegnati</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Incasso</th>
                </tr>
              </thead>
              <tbody>
                {tierRows.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400">Nessun dato nel periodo</td></tr>
                )}
                {tierRows.map((r) => (
                  <tr key={r.tierId} className="border-b border-zinc-50">
                    <td className="px-4 py-2 font-medium text-zinc-900">{r.tierName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.sold}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.consumed}</td>
                    <td className="px-4 py-2 text-right tabular-nums hidden sm:table-cell">{formatEur(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {type === "operator" && (
        <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Operatore</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Ruolo</th>
                <th className="text-right px-4 py-3">Ticket consegnati</th>
              </tr>
            </thead>
            <tbody>
              {operatorRows.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-400">Nessun dato nel periodo</td></tr>
              )}
              {operatorRows.map((r) => (
                <tr key={r.operatorId} className="border-b border-zinc-50">
                  <td className="px-4 py-2 font-medium text-zinc-900">{r.operatorName}</td>
                  <td className="px-4 py-2 text-zinc-500 hidden sm:table-cell">{ROLE_LABELS[r.role] ?? r.role}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{r.consumed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
