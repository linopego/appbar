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
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Richiesta rimborso ricevuta</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5;">
  <div style="max-width: 560px; margin: 40px auto; padding: 40px 32px; background: #fff; border-radius: 12px;">
    <h1 style="margin: 0 0 8px; font-size: 24px;">Richiesta ricevuta</h1>
    <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
      Ciao <strong>${escapeHtml(data.customerName)}</strong>, abbiamo ricevuto la tua richiesta di rimborso per <strong>${data.ticketCount} ticket</strong> da <strong>${escapeHtml(data.venueName)}</strong>.
    </p>

    <div style="background: #fafafa; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #555;"><strong>Importo richiesto:</strong> ${data.amount}</p>
      <p style="margin: 0; font-size: 14px; color: #555;"><strong>Motivazione:</strong> ${escapeHtml(data.reason)}</p>
    </div>

    <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
      Il tuo rimborso verrà esaminato entro 24–48 ore. Riceverai una notifica via email non appena sarà approvato o rifiutato.
    </p>

    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${data.refundUrl}"
         style="display: inline-block; padding: 14px 32px; background: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Vedi stato rimborso
      </a>
    </div>

    <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
      Rimborso #${data.refundId.slice(0, 8).toUpperCase()}
    </p>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
