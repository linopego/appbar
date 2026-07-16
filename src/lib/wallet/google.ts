import { SignJWT, importPKCS8 } from "jose";
import { ticketQrPayload } from "@/lib/qr/render";

// ─────────────────────────────────────────────────────────────────────────────
// Google Wallet: link "Salva su Google Wallet" via JWT firmato col service
// account (formato documentato: https://developers.google.com/wallet —
// JWT RS256 con typ "savetowallet", classi/oggetti embedded nel payload,
// URL di salvataggio https://pay.google.com/gp/v/save/<jwt>).
//
// Classe EventTicket per venue (id deterministico issuerId.klink-[venueSlug],
// creata/riusata al salvataggio perché embedded nel JWT), oggetto per ticket.
// Pass statico per l'MVP: nessun aggiornamento push, la verità resta il POS.
//
// Il barcode contiene ESATTAMENTE la stringa del QR del sito
// (ticketQrPayload): il POS non vede alcuna differenza.
// ─────────────────────────────────────────────────────────────────────────────

const HOW_TO_USE =
  "Mostra questo pass al banco: il barista scansiona il QR e ti serve. " +
  "Ogni QR vale una consumazione e si spegne alla scansione.";

interface GooglePassInput {
  ticketId: string;
  qrToken: string;
  tierName: string;
  venueName: string;
  venueSlug: string;
  expiresAt: Date;
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function baseUrl(): string {
  return (
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000"
  );
}

export async function buildGoogleSaveUrl(input: GooglePassInput): Promise<string> {
  const issuerId = process.env["GOOGLE_WALLET_ISSUER_ID"];
  const saKeyBase64 = process.env["GOOGLE_WALLET_SA_KEY_BASE64"];
  if (!issuerId || !saKeyBase64) throw new Error("Google Wallet non configurato");

  const sa = JSON.parse(Buffer.from(saKeyBase64, "base64").toString("utf8")) as ServiceAccountKey;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("Service account Google Wallet non valido");
  }

  const classId = `${issuerId}.klink-${input.venueSlug}`;
  const objectId = `${issuerId}.klink-ticket-${input.ticketId}`;

  // Classe per venue: creata al primo salvataggio, riusata dai successivi
  const eventTicketClass = {
    id: classId,
    issuerName: "Klink",
    eventName: { defaultValue: { language: "it-IT", value: input.venueName } },
    reviewStatus: "UNDER_REVIEW",
  };

  const eventTicketObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    // Colori brand (BRAND.md): sfondo Ink; testo/label li gestisce Google
    hexBackgroundColor: "#0F1230",
    // STESSA stringa del QR del sito: il POS non deve accorgersi di nulla
    barcode: { type: "QR_CODE", value: ticketQrPayload(input.qrToken) },
    validTimeInterval: { end: { date: input.expiresAt.toISOString() } },
    ticketType: { defaultValue: { language: "it-IT", value: input.tierName } },
    textModulesData: [
      { header: "Consumazione", body: input.tierName, id: "tier" },
      { header: "Valido fino al", body: dateFmt.format(input.expiresAt), id: "expiry" },
      { header: "Come si usa", body: HOW_TO_USE, id: "howto" },
    ],
  };

  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    origins: [baseUrl()],
    payload: {
      eventTicketClasses: [eventTicketClass],
      eventTicketObjects: [eventTicketObject],
    },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .sign(key);

  return `https://pay.google.com/gp/v/save/${jwt}`;
}
