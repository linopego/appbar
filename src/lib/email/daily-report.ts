import { sendEmail } from "./client";
import { EMAIL_COLORS, emailLayout, emailPanel, escapeHtml } from "./brand";
import type { CorrispettiviReport, TierAggregate } from "@/lib/reports/corrispettivi";
import { FISCAL_DISCLAIMER } from "@/lib/reports/corrispettivi";
import { formatEur } from "@/lib/utils/money";

// Email giornaliera dei corrispettivi al manager (07:00 Europe/Rome):
// il riepilogo del giorno precedente da battere sul registratore.

function tierRowsHtml(aggregate: TierAggregate, totalLabel: string): string {
  const rows = aggregate.rows
    .map(
      (r) => `
      <tr>
        <td style="padding: 4px 0; color: ${EMAIL_COLORS.inkSoft}; font-size: 14px;">${escapeHtml(r.tierName)}</td>
        <td style="padding: 4px 0; color: ${EMAIL_COLORS.inkSoft}; font-size: 14px; text-align: right; white-space: nowrap;">
          ${r.quantity} × ${formatEur(r.unitPrice)} = <strong style="color: ${EMAIL_COLORS.ink};">${formatEur(r.total)}</strong>
        </td>
      </tr>`
    )
    .join("");
  return `
    <table style="width: 100%; border-collapse: collapse;">
      ${rows}
      <tr>
        <td style="padding: 8px 0 0; color: ${EMAIL_COLORS.ink}; font-size: 14px; font-weight: 600; border-top: 1px solid ${EMAIL_COLORS.border};">
          ${escapeHtml(totalLabel)} (${aggregate.totalQuantity} ticket)
        </td>
        <td style="padding: 8px 0 0; color: ${EMAIL_COLORS.ink}; font-size: 14px; font-weight: 600; text-align: right; border-top: 1px solid ${EMAIL_COLORS.border};">
          ${formatEur(aggregate.total)}
        </td>
      </tr>
    </table>`;
}

// Documenti fiscali in sofferenza (venue con emissione attiva): errori
// definitivi o in attesa da più di 24 ore.
export interface FiscalAlert {
  failedCount: number;
  stalePendingCount: number;
}

export function hasFiscalAlert(alert: FiscalAlert | null | undefined): boolean {
  return Boolean(alert && (alert.failedCount > 0 || alert.stalePendingCount > 0));
}

export function dailyReportHtml({
  venueName,
  day,
  report,
  fiscalAlert,
}: {
  venueName: string;
  day: string; // YYYY-MM-DD (giornata solare Europe/Rome)
  report: CorrispettiviReport;
  fiscalAlert?: FiscalAlert | null;
}): string {
  const refundLine =
    report.refunded.count > 0
      ? `<p style="margin: 12px 0 0; font-size: 14px; color: ${EMAIL_COLORS.error};">
           Rimborsato nel giorno (${report.refunded.count} ${report.refunded.count === 1 ? "rimborso" : "rimborsi"}, separato dal venduto): −${formatEur(report.refunded.total)}
         </p>`
      : "";

  const fiscalAlertLine = hasFiscalAlert(fiscalAlert)
    ? `<p style="margin: 0 0 16px; font-size: 14px; color: ${EMAIL_COLORS.error}; font-weight: 600;">
         Documenti fiscali da controllare: ${[
           fiscalAlert!.failedCount > 0
             ? `${fiscalAlert!.failedCount} in errore definitivo`
             : null,
           fiscalAlert!.stalePendingCount > 0
             ? `${fiscalAlert!.stalePendingCount} in attesa da oltre 24 ore`
             : null,
         ]
           .filter(Boolean)
           .join(", ")}. Apri gli ordini nel pannello per riprovare l'emissione.
       </p>`
    : "";

  const bodyHtml = `
    <h1 style="margin: 0 0 4px; font-size: 22px; color: ${EMAIL_COLORS.ink};">Corrispettivi del ${escapeHtml(day)}</h1>
    ${fiscalAlertLine}
    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; font-size: 14px; line-height: 1.5;">
      ${escapeHtml(venueName)} — giornata solare italiana. Due basi distinte:
      il consulente indica quale registrare.
    </p>

    ${emailPanel(`
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: ${EMAIL_COLORS.ink}; text-transform: uppercase; letter-spacing: 0.04em;">Venduto — incassato del giorno</p>
      ${report.sold.rows.length > 0 ? tierRowsHtml(report.sold, "Totale venduto") : `<p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.inkMuted};">Nessuna vendita.</p>`}
      ${refundLine}
    `)}

    ${emailPanel(`
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: ${EMAIL_COLORS.ink}; text-transform: uppercase; letter-spacing: 0.04em;">Consumato — erogato del giorno</p>
      ${report.consumed.rows.length > 0 ? tierRowsHtml(report.consumed, "Totale consumato") : `<p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.inkMuted};">Nessuna consumazione.</p>`}
    `)}

    <p style="margin: 0; color: ${EMAIL_COLORS.inkMuted}; font-size: 12px; line-height: 1.5;">
      ${escapeHtml(FISCAL_DISCLAIMER)}
    </p>`;

  return emailLayout({ title: `Corrispettivi del ${day}`, bodyHtml });
}

export async function sendDailyReportEmail({
  to,
  venueName,
  day,
  report,
  fiscalAlert,
}: {
  to: string;
  venueName: string;
  day: string;
  report: CorrispettiviReport;
  fiscalAlert?: FiscalAlert | null;
}): Promise<void> {
  await sendEmail({
    to,
    subject: `Corrispettivi ${venueName} — ${day}`,
    html: dailyReportHtml({ venueName, day, report, fiscalAlert: fiscalAlert ?? null }),
  });
}
