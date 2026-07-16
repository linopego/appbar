import { EMAIL_COLORS, emailCta, emailLayout, emailPanel, escapeHtml } from "@/lib/email/brand";

export interface OrderConfirmationData {
  customerName: string;
  venueName: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; unitPrice: string; subtotal: string }>;
  total: string;
  ticketsCount: number;
  expiresAt: Date;
  orderUrl: string;
  // Link testuali "Aggiungi al Wallet" per ticket (feature flag: vuoto se i
  // wallet non sono configurati); niente badge immagine pesanti in email
  walletLinks?: Array<{ label: string; appleUrl?: string; googleUrl?: string }>;
}

export function renderOrderConfirmationHtml(data: OrderConfirmationData): string {
  const expiresFormatted = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(data.expiresAt);

  const itemsRows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding: 8px 0; color: ${EMAIL_COLORS.inkSoft};">${i.quantity}× ${escapeHtml(i.name)}</td>
        <td style="padding: 8px 0; text-align: right; color: ${EMAIL_COLORS.inkSoft}; font-variant-numeric: tabular-nums;">${i.subtotal}</td>
      </tr>
    `
    )
    .join("");

  return emailLayout({
    title: "I tuoi ticket",
    bodyHtml: `
    <h1 style="margin: 0 0 8px; font-size: 24px; color: ${EMAIL_COLORS.ink};">Ciao ${escapeHtml(data.customerName)} 👋</h1>
    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5;">
      Il tuo pagamento è stato ricevuto. Hai <strong style="color: ${EMAIL_COLORS.ink};">${data.ticketsCount} ticket</strong> validi per <strong style="color: ${EMAIL_COLORS.ink};">${escapeHtml(data.venueName)}</strong>.
    </p>

    ${emailPanel(`
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsRows}
        <tr style="border-top: 1px solid ${EMAIL_COLORS.border};">
          <td style="padding: 12px 0 0; font-weight: 600; color: ${EMAIL_COLORS.ink};">Totale</td>
          <td style="padding: 12px 0 0; text-align: right; font-weight: 600; color: ${EMAIL_COLORS.ink}; font-variant-numeric: tabular-nums;">${data.total}</td>
        </tr>
      </table>
    `)}

    ${emailCta(data.orderUrl, "Apri i tuoi QR")}

    ${
      data.walletLinks && data.walletLinks.length > 0
        ? `
    <p style="margin: 0 0 4px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5; font-size: 14px;">
      <strong style="color: ${EMAIL_COLORS.ink};">Aggiungi al Wallet</strong> (il QR anche offline):
    </p>
    <ul style="margin: 0 0 24px; padding-left: 18px; color: ${EMAIL_COLORS.inkSoft}; font-size: 14px; line-height: 1.7;">
      ${data.walletLinks
        .map((t) => {
          const links = [
            t.appleUrl ? `<a href="${t.appleUrl}" style="color: ${EMAIL_COLORS.ink};">Apple Wallet</a>` : "",
            t.googleUrl ? `<a href="${t.googleUrl}" style="color: ${EMAIL_COLORS.ink};">Google Wallet</a>` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return `<li>${escapeHtml(t.label)}: ${links}</li>`;
        })
        .join("")}
    </ul>`
        : ""
    }

    <p style="margin: 0 0 8px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5; font-size: 14px;">
      <strong style="color: ${EMAIL_COLORS.ink};">Come funziona:</strong> apri il link sopra dal tuo telefono al banco: trovi un QR grande per ogni ticket. Il barista li scansiona e ti serve.
    </p>
    <p style="margin: 0 0 24px; color: ${EMAIL_COLORS.inkSoft}; line-height: 1.5; font-size: 14px;">
      I ticket sono validi fino al <strong style="color: ${EMAIL_COLORS.ink};">${expiresFormatted}</strong>.
    </p>

    <p style="margin: 0; color: ${EMAIL_COLORS.inkMuted}; font-size: 12px; text-align: center;">
      Ordine #${data.orderId.slice(0, 8).toUpperCase()}
    </p>`,
  });
}
