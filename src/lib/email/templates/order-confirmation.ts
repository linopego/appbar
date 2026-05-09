export interface OrderConfirmationData {
  customerName: string;
  venueName: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; unitPrice: string; subtotal: string }>;
  total: string;
  ticketsCount: number;
  expiresAt: Date;
  orderUrl: string;
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
        <td style="padding: 8px 0; color: #333;">${i.quantity}× ${escapeHtml(i.name)}</td>
        <td style="padding: 8px 0; text-align: right; color: #333;">${i.subtotal}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>I tuoi ticket</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5;">
  <div style="max-width: 560px; margin: 40px auto; padding: 40px 32px; background: #fff; border-radius: 12px;">
    <h1 style="margin: 0 0 8px; font-size: 24px;">Ciao ${escapeHtml(data.customerName)} 👋</h1>
    <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
      Il tuo pagamento è stato ricevuto. Hai <strong>${data.ticketsCount} ticket</strong> validi per <strong>${escapeHtml(data.venueName)}</strong>.
    </p>

    <div style="background: #fafafa; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsRows}
        <tr style="border-top: 1px solid #e5e5e5;">
          <td style="padding: 12px 0 0; font-weight: 600; color: #000;">Totale</td>
          <td style="padding: 12px 0 0; text-align: right; font-weight: 600; color: #000;">${data.total}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${data.orderUrl}"
         style="display: inline-block; padding: 14px 32px; background: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Vedi i tuoi ticket
      </a>
    </div>

    <p style="margin: 0 0 8px; color: #555; line-height: 1.5; font-size: 14px;">
      <strong>Come funziona:</strong> apri il link sopra dal tuo telefono al banco. Il barista scansionerà il QR di ogni ticket per consegnarti la consumazione.
    </p>
    <p style="margin: 0 0 24px; color: #555; line-height: 1.5; font-size: 14px;">
      I ticket sono validi fino al <strong>${expiresFormatted}</strong>.
    </p>

    <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
      Ordine #${data.orderId.slice(0, 8).toUpperCase()}
    </p>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
