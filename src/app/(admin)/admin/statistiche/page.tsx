import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { formatEur } from "@/lib/utils/money";
import {
  getDailyStats,
  getOperatorStats,
  getTierStats,
  parseStatsRange,
  type DailyStatsRow,
  type OperatorStatsRow,
  type TierStatsRow,
} from "@/lib/reports/stats";
import { DailyBarChart, TierPieChart } from "@/components/reports/stats-charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statistiche — Admin" };

type TabType = "daily" | "tier" | "operator";

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

  const { from, to, range } = parseStatsRange(sp.from, sp.to, new Date());

  let dailyRows: DailyStatsRow[] = [];
  let tierRows: TierStatsRow[] = [];
  let operatorRows: OperatorStatsRow[] = [];

  try {
    if (type === "daily") dailyRows = await getDailyStats(session.venueId, range);
    else if (type === "tier") tierRows = await getTierStats(session.venueId, range);
    else operatorRows = await getOperatorStats(session.venueId, range);
  } catch (e) {
    console.error("Stats error", e);
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
