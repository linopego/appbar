import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
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
export const metadata = { title: "Statistiche — Super Admin" };

// Statistiche per venue, scopate: ORG_ADMIN vede solo i venue della propria
// organizzazione. Stesse query del pannello responsabile (lib condivisa).

type TabType = "daily" | "tier" | "operator";

const TABS: { type: TabType; label: string }[] = [
  { type: "daily", label: "Per giorno" },
  { type: "tier", label: "Per fascia" },
  { type: "operator", label: "Per operatore" },
];

const ROLE_LABELS: Record<string, string> = { BARISTA: "Barista", CASSIERE: "Cassiere" };

export default async function SuperadminStatistichePage({
  searchParams,
}: {
  searchParams: Promise<{ venueId?: string; type?: string; from?: string; to?: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const scope = orgScopeWhere(session);
  const venues = await db.venue.findMany({
    where: scope.venue,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const sp = await searchParams;
  const type: TabType = (["daily", "tier", "operator"] as TabType[]).includes(sp.type as TabType)
    ? (sp.type as TabType)
    : "daily";
  const { from, to, range } = parseStatsRange(sp.from, sp.to, new Date());

  // Venue selezionato SOLO se dentro lo scope: un id fuori scope equivale a nessuno
  const selectedVenue = sp.venueId ? (venues.find((v) => v.id === sp.venueId) ?? null) : null;

  let dailyRows: DailyStatsRow[] = [];
  let tierRows: TierStatsRow[] = [];
  let operatorRows: OperatorStatsRow[] = [];
  if (selectedVenue) {
    if (type === "daily") dailyRows = await getDailyStats(selectedVenue.id, range);
    else if (type === "tier") tierRows = await getTierStats(selectedVenue.id, range);
    else operatorRows = await getOperatorStats(selectedVenue.id, range);
  }

  function qs(overrides: Record<string, string>) {
    const p = new URLSearchParams({
      ...(selectedVenue ? { venueId: selectedVenue.id } : {}),
      type,
      from,
      to,
      ...overrides,
    });
    return `?${p.toString()}`;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/superadmin" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Super Admin
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Statistiche</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Venduto, consegnato e operatori per venue. Ultimi 30 giorni di default.
          </p>
        </div>

        <form
          method="get"
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="type" value={type} />
          <label className="text-sm">
            <span className="block text-xs text-zinc-500 mb-1">Venue</span>
            <select
              name="venueId"
              defaultValue={selectedVenue?.id ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">— Seleziona venue —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-zinc-500 mb-1">Da</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-zinc-500 mb-1">A</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
          >
            Applica
          </button>
        </form>

        {!selectedVenue ? (
          <p className="text-sm text-zinc-500">Seleziona un venue per vedere le statistiche.</p>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 border-b border-zinc-800">
              {TABS.map((tab) => (
                <Link
                  key={tab.type}
                  href={`/superadmin/statistiche${qs({ type: tab.type })}`}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    type === tab.type
                      ? "border-zinc-100 text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            {type === "daily" && (
              <div className="space-y-6">
                {/* I grafici usano i token di tema: sfondo chiaro per leggibilità */}
                <div className="rounded-xl border border-zinc-800 bg-white p-4">
                  <DailyBarChart data={dailyRows} />
                </div>

                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                        <th className="text-left px-4 py-3">Data</th>
                        <th className="text-right px-4 py-3">Venduti</th>
                        <th className="text-right px-4 py-3">Consegnati</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyRows.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                            Nessun dato nel periodo
                          </td>
                        </tr>
                      )}
                      {dailyRows.map((r) => (
                        <tr key={r.date} className="border-b border-zinc-800/50">
                          <td className="px-4 py-2 text-zinc-300">{r.date}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-100">{r.sold}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-100">{r.consumed}</td>
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
                  <div className="rounded-xl border border-zinc-800 bg-white p-4">
                    <TierPieChart data={tierRows} />
                  </div>
                )}

                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                        <th className="text-left px-4 py-3">Fascia</th>
                        <th className="text-right px-4 py-3">Venduti</th>
                        <th className="text-right px-4 py-3">Consegnati</th>
                        <th className="text-right px-4 py-3 hidden sm:table-cell">Incasso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                            Nessun dato nel periodo
                          </td>
                        </tr>
                      )}
                      {tierRows.map((r) => (
                        <tr key={r.tierId} className="border-b border-zinc-800/50">
                          <td className="px-4 py-2 font-medium text-zinc-100">{r.tierName}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-100">{r.sold}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-100">{r.consumed}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-100 hidden sm:table-cell">
                            {formatEur(r.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {type === "operator" && (
              <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                      <th className="text-left px-4 py-3">Operatore</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Ruolo</th>
                      <th className="text-right px-4 py-3">Ticket consegnati</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operatorRows.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                          Nessun dato nel periodo
                        </td>
                      </tr>
                    )}
                    {operatorRows.map((r) => (
                      <tr key={r.operatorId} className="border-b border-zinc-800/50">
                        <td className="px-4 py-2 font-medium text-zinc-100">{r.operatorName}</td>
                        <td className="px-4 py-2 text-zinc-400 hidden sm:table-cell">
                          {ROLE_LABELS[r.role] ?? r.role}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-zinc-100">
                          {r.consumed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
