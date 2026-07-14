import { EMAIL_COLORS, emailCta, emailLayout, emailPanel, escapeHtml } from "@/lib/email/brand";

export interface RefundNewForManagerData {
  managerName: string;
  venueName: string;
  customerName: string;
  customerEmail: string;
  refundId: string;
  amount: string;
  ticketCount: number;
  reason: string;
  adminUrl: string;
}

export function renderRefundNewForManagerHtml(data: RefundNewForManagerData): string {
  return emailLayout({
    title: "Nuova richiesta rimborso",
    bodyHtml: `
    <h1 style="margin: 0 0 8px; font-size: 24px; color: ${EMAIL_COLORS.ink};">Nuova richiesta rimborso</h1>
    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
      Ciao <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.managerName)}</strong>, è arrivata una nuova richiesta di rimborso per <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.venueName)}</strong>.
    </p>

    ${emailPanel(`
      <p style="margin: 0 0 8px; font-size: 14px; color: ${EMAIL_COLORS.inkSoft};"><strong style="color: ${EMAIL_COLORS.ink};">Cliente:</strong> ${escapeHtml(data.customerName)} (${escapeHtml(data.customerEmail)})</p>
      <p style="margin: 0 0 8px; font-size: 14px; color: ${EMAIL_COLORS.inkSoft};"><strong style="color: ${EMAIL_COLORS.ink};">Importo:</strong> ${data.amount} (${data.ticketCount} ticket)</p>
      <p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.inkSoft};"><strong style="color: ${EMAIL_COLORS.ink};">Motivazione:</strong> ${escapeHtml(data.reason)}</p>
    `)}

    ${emailCta(data.adminUrl, "Gestisci rimborso")}

    <p style="margin: 0; color: ${EMAIL_COLORS.inkMuted}; font-size: 12px; text-align: center;">
      Rimborso #${data.refundId.slice(0, 8).toUpperCase()}
    </p>`,
  });
}
