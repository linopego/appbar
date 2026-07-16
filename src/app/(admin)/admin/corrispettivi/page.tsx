import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import {
  getCorrispettivi,
  parseReportDays,
  rangeInTimezone,
} from "@/lib/reports/corrispettivi";
import { CorrispettiviView } from "@/components/reports/corrispettivi-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Corrispettivi — Admin" };

// Report corrispettivi del venue: il numero esatto da battere come scontrino
// riepilogativo. Giornata solare Europe/Rome, default ieri.
export default async function CorrispettiviPage({
  searchParams,
}: {
  searchParams: Promise<{ da?: string; a?: string }>;
}) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const sp = await searchParams;
  const now = new Date();
  const { da, a } = parseReportDays(sp.da, sp.a, now);
  const report = await getCorrispettivi(session.venueId, rangeInTimezone(da, a));

  const csvHref = `/api/admin/reports/corrispettivi/export?da=${da}&a=${a}`;
  const singleDay = da === a;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Corrispettivi</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Riepilogo giornaliero per la registrazione dei corrispettivi sul
          registratore del locale. Periodo: {singleDay ? da : `${da} → ${a}`} (giornata
          solare italiana).
        </p>
      </div>

      {/* Selettore giorno/intervallo: form GET, default ieri */}
      <form method="get" className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-zinc-700">
          <span className="block text-xs text-zinc-500 mb-1">Dal giorno</span>
          <input
            type="date"
            name="da"
            defaultValue={da}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-zinc-700">
          <span className="block text-xs text-zinc-500 mb-1">Al giorno</span>
          <input
            type="date"
            name="a"
            defaultValue={a}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 text-sm font-medium transition-colors"
        >
          Aggiorna
        </button>
        {/* Download di file da API route: serve <a> nativo, non <Link> */}
        <a
          href={csvHref}
          className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors"
        >
          Esporta CSV
        </a>
      </form>

      <CorrispettiviView report={report} theme="light" />
    </div>
  );
}
