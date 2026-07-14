import { EMAIL_COLORS, emailCta, emailLayout, emailPanel, escapeHtml } from "@/lib/email/brand";

export interface RefundApprovedData {
  customerName: string;
  venueName: string;
  refundId: string;
  amount: string;
  ticketCount: number;
  managerNote?: string | null;
  refundUrl: string;
}

export function renderRefundApprovedHtml(data: RefundApprovedData): string {
  const noteBlock = data.managerNote
    ? emailPanel(
        `<p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.inkSoft};"><strong style="color: ${EMAIL_COLORS.ink};">Nota:</strong> ${escapeHtml(data.managerNote)}</p>`
      )
    : "";

  return emailLayout({
    title: "Rimborso approvato",
    bodyHtml: `
    <div style="display: inline-block; background: ${EMAIL_COLORS.limeSoft}; color: ${EMAIL_COLORS.ink}; border-radius: 9999px; padding: 6px 14px; font-size: 13px; font-weight: 600; margin: 0 0 16px;">✓ Approvato</div>
    <h1 style="margin: 0 0 8px; font-size: 24px; color: ${EMAIL_COLORS.ink};">Rimborso approvato</h1>
    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
      Ciao <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.customerName)}</strong>, il tuo rimborso di <strong style="color: ${EMAIL_COLORS.ink};">${data.amount}</strong> per ${data.ticketCount} ticket di <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.venueName)}</strong> è stato approvato.
    </p>

    ${noteBlock}

    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
      L'importo verrà accreditato sul tuo metodo di pagamento originale entro 5–10 giorni lavorativi, a seconda della tua banca.
    </p>

    ${emailCta(data.refundUrl, "Vedi dettaglio rimborso")}

    <p style="margin: 0; color: ${EMAIL_COLORS.inkMuted}; font-size: 12px; text-align: center;">
      Rimborso #${data.refundId.slice(0, 8).toUpperCase()}
    </p>`,
  });
}
