import { EMAIL_COLORS, emailCta, emailLayout, emailPanel, escapeHtml } from "@/lib/email/brand";

export interface RefundRequestedData {
  customerName: string;
  venueName: string;
  refundId: string;
  amount: string;
  ticketCount: number;
  reason: string;
  refundUrl: string;
}

export function renderRefundRequestedHtml(data: RefundRequestedData): string {
  return emailLayout({
    title: "Richiesta rimborso ricevuta",
    bodyHtml: `
    <h1 style="margin: 0 0 8px; font-size: 24px; color: ${EMAIL_COLORS.ink};">Richiesta ricevuta</h1>
    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
      Ciao <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.customerName)}</strong>, abbiamo ricevuto la tua richiesta di rimborso per <strong style="color: ${EMAIL_COLORS.ink};">${data.ticketCount} ticket</strong> da <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.venueName)}</strong>.
    </p>

    ${emailPanel(`
      <p style="margin: 0 0 8px; font-size: 14px; color: ${EMAIL_COLORS.inkSoft};"><strong style="color: ${EMAIL_COLORS.ink};">Importo richiesto:</strong> ${data.amount}</p>
      <p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.inkSoft};"><strong style="color: ${EMAIL_COLORS.ink};">Motivazione:</strong> ${escapeHtml(data.reason)}</p>
    `)}

    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
      Il tuo rimborso verrà esaminato entro 24–48 ore. Riceverai una notifica via email non appena sarà approvato o rifiutato.
    </p>

    ${emailCta(data.refundUrl, "Vedi stato rimborso")}

    <p style="margin: 0; color: ${EMAIL_COLORS.inkMuted}; font-size: 12px; text-align: center;">
      Rimborso #${data.refundId.slice(0, 8).toUpperCase()}
    </p>`,
  });
}
