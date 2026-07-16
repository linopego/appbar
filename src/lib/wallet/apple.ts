import forge from "node-forge";
import { PKPass } from "passkit-generator";
import { ticketQrPayload } from "@/lib/qr/render";
import { PASS_IMAGES_BASE64 } from "./pass-assets";

// ─────────────────────────────────────────────────────────────────────────────
// Apple Wallet (.pkpass) — pass STATICO per l'MVP: nessun web service di
// aggiornamento push (nessun webServiceURL/authenticationToken). La verità
// sullo stato del ticket resta il POS, che rifiuta i consumati/scaduti.
// Evoluzione futura: registrare un web service pass type per aggiornare o
// invalidare il pass alla consumazione (push APNs).
//
// Il barcode contiene ESATTAMENTE la stringa del QR del sito
// (ticketQrPayload): il POS non vede alcuna differenza.
// ─────────────────────────────────────────────────────────────────────────────

// Colori brand (BRAND.md): sfondo Ink, testo bianco, label lime.
// I pass vogliono i colori in rgb(); gli hex di riferimento vivono in BRAND.md.
const PASS_BACKGROUND = "rgb(15,18,48)"; // --klink-ink
const PASS_FOREGROUND = "rgb(255,255,255)";
const PASS_LABEL = "rgb(200,255,46)"; // --klink-lime

const HOW_TO_USE =
  "Mostra questo pass al banco: il barista scansiona il QR e ti serve. " +
  "Ogni QR vale una consumazione e si spegne alla scansione. " +
  "Se il ticket risulta già usato o scaduto, il banco lo vedrà alla scansione.";

interface ApplePassInput {
  ticketId: string;
  qrToken: string;
  tierName: string;
  venueName: string;
  expiresAt: Date;
}

// Estrae dal .p12 (base64) il certificato firmatario, la chiave privata e il
// certificato intermedio WWDR. Il .p12 va esportato INCLUDENDO la catena
// (Keychain: seleziona certificato + WWDR → esporta), vedi .env.example.
export function extractP12Certificates(
  p12Base64: string,
  password: string
): { signerCert: string; signerKey: string; wwdr: string } {
  const der = forge.util.decode64(p12Base64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), password);

  const keyBagType = forge.pki.oids["pkcs8ShroudedKeyBag"] as string;
  const certBagType = forge.pki.oids["certBag"] as string;
  const keyBags = p12.getBags({ bagType: keyBagType })[keyBagType] ?? [];
  const certBags = p12.getBags({ bagType: certBagType })[certBagType] ?? [];

  const key = keyBags[0]?.key;
  if (!key) throw new Error("Il .p12 non contiene una chiave privata");

  const certs = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c));
  if (certs.length === 0) throw new Error("Il .p12 non contiene certificati");

  // Il firmatario è il certificato la cui chiave pubblica corrisponde alla
  // chiave privata; l'altro (intermedio Apple WWDR) serve per la catena.
  const publicN = (key as forge.pki.rsa.PrivateKey).n.toString(16);
  const signer = certs.find(
    (c) => (c.publicKey as forge.pki.rsa.PublicKey).n.toString(16) === publicN
  );
  if (!signer) throw new Error("Nel .p12 manca il certificato del firmatario");

  const wwdr = certs.find((c) => c !== signer);
  if (!wwdr) {
    throw new Error(
      "Nel .p12 manca il certificato intermedio Apple WWDR: esporta dal portachiavi includendo la catena"
    );
  }

  return {
    signerCert: forge.pki.certificateToPem(signer),
    signerKey: forge.pki.privateKeyToPem(key as forge.pki.rsa.PrivateKey),
    wwdr: forge.pki.certificateToPem(wwdr),
  };
}

// Il barcode del pass: ESATTAMENTE la stringa del QR del sito. Esportato
// separatamente così i test verificano l'invariante senza certificati.
export function applePassBarcode(qrToken: string): {
  message: string;
  format: "PKBarcodeFormatQR";
  messageEncoding: string;
} {
  return {
    message: ticketQrPayload(qrToken),
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
  };
}

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export async function buildApplePass(input: ApplePassInput): Promise<Buffer> {
  const certBase64 = process.env["APPLE_PASS_CERT_BASE64"];
  const certPassword = process.env["APPLE_PASS_CERT_PASSWORD"];
  const teamId = process.env["APPLE_TEAM_ID"];
  const passTypeId = process.env["APPLE_PASS_TYPE_ID"];
  if (!certBase64 || !certPassword || !teamId || !passTypeId) {
    throw new Error("Apple Wallet non configurato");
  }

  const { signerCert, signerKey, wwdr } = extractP12Certificates(certBase64, certPassword);

  const images: Record<string, Buffer> = {};
  for (const [name, b64] of Object.entries(PASS_IMAGES_BASE64)) {
    images[name] = Buffer.from(b64, "base64");
  }

  const pass = new PKPass(
    images,
    { wwdr, signerCert, signerKey },
    {
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      teamIdentifier: teamId,
      serialNumber: input.ticketId,
      organizationName: "Klink",
      description: `${input.tierName} — ${input.venueName}`,
      backgroundColor: PASS_BACKGROUND,
      foregroundColor: PASS_FOREGROUND,
      labelColor: PASS_LABEL,
    }
  );
  pass.type = "eventTicket";

  // Nome fascia in evidenza, locale e scadenza sotto
  pass.primaryFields.push({ key: "tier", label: "CONSUMAZIONE", value: input.tierName });
  pass.secondaryFields.push({ key: "venue", label: "LOCALE", value: input.venueName });
  pass.auxiliaryFields.push({
    key: "expiry",
    label: "VALIDO FINO AL",
    value: dateFmt.format(input.expiresAt),
  });
  pass.backFields.push({ key: "howto", label: "Come si usa", value: HOW_TO_USE });

  // STESSA stringa del QR del sito: il POS non deve accorgersi di nulla
  pass.setBarcodes({ ...applePassBarcode(input.qrToken), altText: input.tierName });
  pass.setExpirationDate(input.expiresAt);

  return pass.getAsBuffer();
}
