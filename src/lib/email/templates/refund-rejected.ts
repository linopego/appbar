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
    ? `<div style="background: #fef2f2; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
        <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Motivazione:</strong> ${escapeHtml(data.managerNote)}</p>
       </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rimborso non approvato</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5;">
  <div style="max-width: 560px; margin: 40px auto; padding: 40px 32px; background: #fff; border-radius: 12px;">
    <h1 style="margin: 0 0 8px; font-size: 24px; color: #991b1b;">Rimborso non approvato</h1>
    <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
      Ciao <strong>${escapeHtml(data.customerName)}</strong>, la tua richiesta di rimborso di <strong>${data.amount}</strong> per ${data.ticketCount} ticket di <strong>${escapeHtml(data.venueName)}</strong> non è stata approvata.
    </p>

    ${noteBlock}

    <p style="margin: 0 0 24px; color: #555; line-height: 1.5;">
      I tuoi ticket rimangono validi. Se hai domande, contatta il locale direttamente.
    </p>

    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${data.refundUrl}"
         style="display: inline-block; padding: 14px 32px; background: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Vedi dettaglio rimborso
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
