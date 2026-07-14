import { EMAIL_COLORS, emailCta, emailLayout, emailPanel, escapeHtml } from "@/lib/email/brand";

export interface RefundRejectedData {
  customerName: string;
  venueName: string;
  refundId: string;
  amount: string;
  ticketCount: number;
  managerNote?: string | null;
  refundUrl: string;
}

export function renderRefundRejectedHtml(data: RefundRejectedData): string {
  const noteBlock = data.managerNote
    ? emailPanel(
        `<p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.inkSoft};"><strong style="color: ${EMAIL_COLORS.ink};">Motivazione:</strong> ${escapeHtml(data.managerNote)}</p>`
      )
    : "";

  return emailLayout({
    title: "Rimborso non approvato",
    bodyHtml: `
    <h1 style="margin: 0 0 8px; font-size: 24px; color: ${EMAIL_COLORS.error};">Rimborso non approvato</h1>
    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
      Ciao <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.customerName)}</strong>, la tua richiesta di rimborso di <strong style="color: ${EMAIL_COLORS.ink};">${data.amount}</strong> per ${data.ticketCount} ticket di <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.venueName)}</strong> non è stata approvata.
    </p>

    ${noteBlock}

    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
      I tuoi ticket rimangono validi. Se hai domande, contatta il locale direttamente.
    </p>

    ${emailCta(data.refundUrl, "Vedi dettaglio rimborso")}

    <p style="margin: 0; color: ${EMAIL_COLORS.inkMuted}; font-size: 12px; text-align: center;">
      Rimborso #${data.refundId.slice(0, 8).toUpperCase()}
    </p>`,
  });
}
