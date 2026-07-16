import QRCode from "qrcode";

// LA stringa codificata nel QR del ticket: URL della pagina pubblica.
// È ciò che il POS scansiona (extractTicketToken accetta questa forma).
// UNICA fonte: anche i pass Apple/Google Wallet DEVONO usare questa funzione,
// così il POS non vede alcuna differenza tra QR del sito e QR del wallet.
export function ticketQrPayload(qrToken: string): string {
  const base =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
  return `${base}/ticket/${qrToken}`;
}

const ticketUrl = ticketQrPayload;

export async function renderQrDataUrl(
  qrToken: string,
  options: { size?: number; margin?: number } = {}
): Promise<string> {
  return QRCode.toDataURL(ticketUrl(qrToken), {
    errorCorrectionLevel: "M",
    margin: options.margin ?? 2,
    width: options.size ?? 512,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function renderQrSvg(qrToken: string): Promise<string> {
  return QRCode.toString(ticketUrl(qrToken), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
  });
}

// QR generico di un URL (es. mockup della homepage): QR VERO e scansionabile,
// stessi parametri dei QR dei ticket (error correction M, quiet zone).
export async function renderUrlQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
  });
}
