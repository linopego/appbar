import type { CorrispettiviReport, TierAggregate } from "@/lib/reports/corrispettivi";
import { FISCAL_DISCLAIMER } from "@/lib/reports/corrispettivi";
import { formatEur } from "@/lib/utils/money";

// Vista condivisa del report corrispettivi: due colonne distinte ed
// etichettate (VENDUTO e CONSUMATO), perché commercialisti diversi scelgono
// basi diverse. Usata dal pannello manager (chiaro) e dal superadmin (scuro).

const THEMES = {
  light: {
    card: "rounded-xl border border-zinc-200 bg-white p-4",
    title: "text-sm font-semibold text-zinc-900",
    subtitle: "text-xs text-zinc-500",
    row: "text-sm text-zinc-700",
    total: "text-sm font-semibold text-zinc-900",
    divide: "divide-y divide-zinc-100",
    negative: "text-red-600",
    empty: "text-sm text-zinc-400",
    note: "text-xs text-zinc-500",
  },
  dark: {
    card: "rounded-xl border border-zinc-800 bg-zinc-900 p-4",
    title: "text-sm font-semibold text-zinc-100",
    subtitle: "text-xs text-zinc-500",
    row: "text-sm text-zinc-300",
    total: "text-sm font-semibold text-zinc-100",
    divide: "divide-y divide-zinc-800",
    negative: "text-red-400",
    empty: "text-sm text-zinc-500",
    note: "text-xs text-zinc-500",
  },
} as const;

type Theme = keyof typeof THEMES;

function TierTable({
  aggregate,
  totalLabel,
  theme,
}: {
  aggregate: TierAggregate;
  totalLabel: string;
  theme: Theme;
}) {
  const t = THEMES[theme];
  if (aggregate.rows.length === 0) {
    return <p className={t.empty}>Nessun movimento nel periodo.</p>;
  }
  return (
    <ul className={t.divide}>
      {aggregate.rows.map((row) => (
        <li
          key={`${row.tierName}|${row.unitPrice}`}
          className={`flex items-center justify-between gap-3 py-1.5 ${t.row}`}
        >
          <span className="min-w-0 truncate">{row.tierName}</span>
          <span className="tabular-nums shrink-0">
            {row.quantity} × {formatEur(row.unitPrice)} ={" "}
            <span className="font-medium">{formatEur(row.total)}</span>
          </span>
        </li>
      ))}
      <li className={`flex items-center justify-between gap-3 py-2 ${t.total}`}>
        <span>
          {totalLabel} ({aggregate.totalQuantity} ticket)
        </span>
        <span className="tabular-nums">{formatEur(aggregate.total)}</span>
      </li>
    </ul>
  );
}

export function CorrispettiviView({
  report,
  theme,
}: {
  report: CorrispettiviReport;
  theme: Theme;
}) {
  const t = THEMES[theme];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Colonna VENDUTO: base "incassato per data di pagamento" */}
        <section className={`${t.card} space-y-3`}>
          <div>
            <h2 className={t.title}>VENDUTO — incassato del periodo</h2>
            <p className={`${t.subtitle} mt-0.5`}>
              Ordini pagati nel periodo (giornata solare italiana della data di
              pagamento), importo lordo per fascia.
            </p>
          </div>
          <TierTable aggregate={report.sold} totalLabel="Totale venduto" theme={theme} />
          <div className={`flex items-center justify-between gap-3 pt-2 border-t ${theme === "light" ? "border-zinc-200" : "border-zinc-800"} ${t.row}`}>
            <span>
              Rimborsato nel periodo ({report.refunded.count}{" "}
              {report.refunded.count === 1 ? "rimborso" : "rimborsi"})
            </span>
            <span className={`tabular-nums font-medium ${report.refunded.count > 0 ? t.negative : ""}`}>
              {report.refunded.count > 0 ? `−${formatEur(report.refunded.total)}` : formatEur("0.00")}
            </span>
          </div>
          <p className={t.note}>
            Il rimborsato è separato e NON è sottratto dal venduto: appartiene al
            giorno in cui il rimborso è stato completato.
          </p>
        </section>

        {/* Colonna CONSUMATO: base "erogato per data di scansione" */}
        <section className={`${t.card} space-y-3`}>
          <div>
            <h2 className={t.title}>CONSUMATO — erogato del periodo</h2>
            <p className={`${t.subtitle} mt-0.5`}>
              Ticket scansionati al banco nel periodo (giornata solare italiana
              della consumazione), valorizzati al prezzo pagato.
            </p>
          </div>
          <TierTable aggregate={report.consumed} totalLabel="Totale consumato" theme={theme} />
        </section>
      </div>

      <p className={t.note}>{FISCAL_DISCLAIMER}</p>
    </div>
  );
}
