import QRCode from "qrcode";

// QR stampabile del venue: codifica SOLO l'URL pubblico d'acquisto
// (nessun token, nessun dato sensibile — sicuro da esporre sui banchi).
// Alta risoluzione (1200px) e error correction H per stampe grandi e
// scansioni affidabili anche con QR rovinato.

export function venuePublicUrl(venueSlug: string): string {
  const base =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
  return `${base}/${venueSlug}`;
}

export async function renderVenueQrPosterPng(venueSlug: string): Promise<Buffer> {
  return QRCode.toBuffer(venuePublicUrl(venueSlug), {
    type: "png",
    errorCorrectionLevel: "H",
    width: 1200,
    margin: 4,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
