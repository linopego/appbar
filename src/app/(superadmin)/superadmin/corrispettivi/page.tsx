import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
import {
  getCorrispettivi,
  parseReportDays,
  rangeInTimezone,
} from "@/lib/reports/corrispettivi";
import { CorrispettiviView } from "@/components/reports/corrispettivi-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Corrispettivi — Super Admin" };

// Report corrispettivi per venue, scopato: ORG_ADMIN vede solo i venue della
// propria organizzazione. Giornata solare Europe/Rome, default ieri.
export default async function SuperadminCorrispettiviPage({
  searchParams,
}: {
  searchParams: Promise<{ venueId?: string; da?: string; a?: string }>;
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
  const now = new Date();
  const { da, a } = parseReportDays(sp.da, sp.a, now);

  // Venue selezionato SOLO se dentro lo scope: un id fuori scope equivale a nessuno
  const selectedVenue = sp.venueId ? (venues.find((v) => v.id === sp.venueId) ?? null) : null;
  const report = selectedVenue
    ? await getCorrispettivi(selectedVenue.id, rangeInTimezone(da, a))
    : null;

  const csvHref = selectedVenue
    ? `/api/superadmin/reports/corrispettivi/export?venueId=${selectedVenue.id}&da=${da}&a=${a}`
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Corrispettivi</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Riepilogo per la registrazione dei corrispettivi del venue. Giornata solare
            italiana, default ieri.
          </p>
        </div>

        <form
          method="get"
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-wrap items-end gap-3"
        >
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
            <span className="block text-xs text-zinc-500 mb-1">Dal giorno</span>
            <input
              type="date"
              name="da"
              defaultValue={da}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-zinc-500 mb-1">Al giorno</span>
            <input
              type="date"
              name="a"
              defaultValue={a}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
          >
            Aggiorna
          </button>
          {csvHref && (
            <a
              href={csvHref}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm font-medium transition-colors"
            >
              Esporta CSV
            </a>
          )}
        </form>

        {selectedVenue && report ? (
          <>
            <p className="text-sm text-zinc-400">
              {selectedVenue.name} — periodo {da === a ? da : `${da} → ${a}`}
            </p>
            <CorrispettiviView report={report} theme="dark" />
          </>
        ) : (
          <p className="text-sm text-zinc-500">Seleziona un venue per vedere il report.</p>
        )}
      </div>
    </main>
  );
}
