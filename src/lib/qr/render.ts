import QRCode from "qrcode";

function ticketUrl(qrToken: string): string {
  const base =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
  return `${base}/ticket/${qrToken}`;
}

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
