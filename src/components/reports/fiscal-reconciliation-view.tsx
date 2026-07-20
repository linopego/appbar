import type { FiscalReconciliation } from "@/lib/reports/corrispettivi";
import { formatEur } from "@/lib/utils/money";

// Vista riconciliazione del periodo: totale venduto vs totale dei documenti
// commerciali CONFERMATI per gli stessi ordini, con la differenza in evidenza.
export function FiscalReconciliationView({
  reconciliation,
  soldTotal,
  theme,
}: {
  reconciliation: FiscalReconciliation;
  soldTotal: string;
  theme: "light" | "dark";
}) {
  const dark = theme === "dark";
  const aligned = reconciliation.difference === "0.00";

  const card = dark
    ? "rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3"
    : "rounded-xl border border-zinc-200 bg-white p-4 space-y-3";
  const label = dark ? "text-zinc-400" : "text-zinc-500";
  const value = dark ? "text-zinc-100" : "text-zinc-900";

  return (
    <div className={card}>
      <div>
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${dark ? "text-zinc-300" : "text-zinc-400"}`}>
          Riconciliazione fiscale
        </h2>
        <p className={`text-xs mt-1 ${label}`}>
          Venduto del periodo confrontato con i documenti commerciali emessi per gli stessi ordini.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className={`text-xs mb-1 ${label}`}>Totale venduto</p>
          <p className={`font-semibold tabular-nums ${value}`}>{formatEur(soldTotal)}</p>
        </div>
        <div>
          <p className={`text-xs mb-1 ${label}`}>
            Documenti emessi ({reconciliation.confirmedCount})
          </p>
          <p className={`font-semibold tabular-nums ${value}`}>
            {formatEur(reconciliation.confirmedTotal)}
          </p>
        </div>
        <div>
          <p className={`text-xs mb-1 ${label}`}>Differenza</p>
          <p
            className={`font-semibold tabular-nums ${
              aligned
                ? dark
                  ? "text-green-400"
                  : "text-green-700"
                : dark
                  ? "text-red-400"
                  : "text-red-600"
            }`}
          >
            {formatEur(reconciliation.difference)}
          </p>
        </div>
      </div>

      {aligned ? (
        <p className={`text-xs ${dark ? "text-green-400" : "text-green-700"}`}>
          Tutto il venduto del periodo ha un documento commerciale confermato.
        </p>
      ) : (
        <p className={`text-xs ${dark ? "text-red-400" : "text-red-600"}`}>
          {[
            reconciliation.pendingCount > 0 ? `${reconciliation.pendingCount} in attesa` : null,
            reconciliation.failedCount > 0 ? `${reconciliation.failedCount} in errore` : null,
            reconciliation.missingCount > 0 ? `${reconciliation.missingCount} senza documento` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Documenti non allineati al venduto."}
        </p>
      )}
    </div>
  );
}
