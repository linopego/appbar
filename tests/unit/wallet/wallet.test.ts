// @vitest-environment node
// (jose firma JWT veri: in jsdom l'instanceof Uint8Array cross-realm fallisce)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";

// Wallet Apple/Google: il principio cardine è che il barcode del pass
// contenga ESATTAMENTE la stringa del QR del sito — il POS non deve
// accorgersi di alcuna differenza. La generazione del .pkpass FIRMATO è
// testabile solo con certificati veri: test manuale documentato in fondo.

const { dbMock, qrcodeMock } = vi.hoisted(() => ({
  dbMock: { ticket: { findUnique: vi.fn() } },
  qrcodeMock: { toDataURL: vi.fn().mockResolvedValue("data:..."), toString: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("qrcode", () => ({ default: qrcodeMock }));
// La generazione firmata è mockata nei test degli endpoint (serve un p12 vero)
vi.mock("@/lib/wallet/apple", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/wallet/apple")>();
  return { ...original, buildApplePass: vi.fn().mockResolvedValue(Buffer.from("pkpass")) };
});

import { ticketQrPayload, renderQrDataUrl } from "@/lib/qr/render";
import { extractTicketToken } from "@/lib/pos/extract-token";
import { applePassBarcode } from "@/lib/wallet/apple";
import { buildGoogleSaveUrl } from "@/lib/wallet/google";
import { isAppleWalletConfigured, isGoogleWalletConfigured } from "@/lib/wallet/config";
import { GET as appleRoute } from "@/app/api/tickets/[qrToken]/wallet/apple/route";
import { GET as googleRoute } from "@/app/api/tickets/[qrToken]/wallet/google/route";

const QR_TOKEN = "123e4567-e89b-42d3-a456-426614174000";
const FUTURE = new Date(Date.now() + 7 * 86400_000);
const PAST = new Date(Date.now() - 1000);

const APPLE_ENV = {
  APPLE_PASS_CERT_BASE64: "Y2VydA==",
  APPLE_PASS_CERT_PASSWORD: "pw",
  APPLE_TEAM_ID: "TEAM123",
  APPLE_PASS_TYPE_ID: "pass.com.klink.ticket",
};

function stubAppleEnv() {
  for (const [k, v] of Object.entries(APPLE_ENV)) vi.stubEnv(k, v);
}

function activeTicket() {
  return {
    id: "ticket-1",
    qrToken: QR_TOKEN,
    status: "ACTIVE",
    expiresAt: FUTURE,
    priceTier: { name: "Drink Premium" },
    venue: { name: "La Casa dei Gelsi", slug: "casa-dei-gelsi" },
  };
}

const params = { params: Promise.resolve({ qrToken: QR_TOKEN }) };
const req = new Request("http://localhost/api/test");

beforeEach(() => {
  vi.clearAllMocks();
  qrcodeMock.toDataURL.mockResolvedValue("data:...");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("principio cardine: stessa stringa del QR del sito", () => {
  it("il barcode del pass Apple è ESATTAMENTE ciò che codifica il QR del sito", async () => {
    // ciò che il sito mette nel QR (argomento passato al renderer)
    await renderQrDataUrl(QR_TOKEN);
    const siteQrString = qrcodeMock.toDataURL.mock.calls[0][0] as string;

    // ciò che il pass Apple mette nel barcode
    expect(applePassBarcode(QR_TOKEN).message).toBe(siteQrString);
    // e il POS lo capisce senza differenze
    expect(extractTicketToken(applePassBarcode(QR_TOKEN).message)).toBe(QR_TOKEN);
  });

  it("il barcode del pass Google è ESATTAMENTE ciò che codifica il QR del sito", async () => {
    // chiave RSA vera usa-e-getta: il JWT è firmato e decodificabile davvero
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const saKey = {
      client_email: "wallet@test.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "3388000000012345");
    vi.stubEnv("GOOGLE_WALLET_SA_KEY_BASE64", Buffer.from(JSON.stringify(saKey)).toString("base64"));

    const url = await buildGoogleSaveUrl({
      ticketId: "ticket-1",
      qrToken: QR_TOKEN,
      tierName: "Drink Premium",
      venueName: "La Casa dei Gelsi",
      venueSlug: "casa-dei-gelsi",
      expiresAt: FUTURE,
    });

    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const jwt = url.slice("https://pay.google.com/gp/v/save/".length);
    const payloadPart = jwt.split(".")[1] ?? "";
    const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));

    const obj = claims.payload.eventTicketObjects[0];
    expect(obj.barcode.type).toBe("QR_CODE");
    expect(obj.barcode.value).toBe(ticketQrPayload(QR_TOKEN));
    expect(extractTicketToken(obj.barcode.value)).toBe(QR_TOKEN);
    // classe deterministica per venue
    expect(claims.payload.eventTicketClasses[0].id).toBe("3388000000012345.klink-casa-dei-gelsi");
    expect(obj.classId).toBe("3388000000012345.klink-casa-dei-gelsi");
  });
});

describe("endpoint wallet: solo ticket ACTIVE non scaduti", () => {
  it.each([
    ["CONSUMED", FUTURE],
    ["REFUNDED", FUTURE],
    ["ACTIVE scaduto", PAST],
  ] as const)("ticket %s → 410", async (label, expiresAt) => {
    stubAppleEnv();
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "123");
    vi.stubEnv("GOOGLE_WALLET_SA_KEY_BASE64", "e30=");
    const status = label === "ACTIVE scaduto" ? "ACTIVE" : label;
    dbMock.ticket.findUnique.mockResolvedValue({ ...activeTicket(), status, expiresAt });

    const [appleRes, googleRes] = await Promise.all([
      appleRoute(req, params),
      googleRoute(req, params),
    ]);
    expect(appleRes.status).toBe(410);
    expect(googleRes.status).toBe(410);
  });

  it("ticket inesistente → 404", async () => {
    stubAppleEnv();
    dbMock.ticket.findUnique.mockResolvedValue(null);
    const res = await appleRoute(req, params);
    expect(res.status).toBe(404);
  });

  it("ticket ACTIVE valido → .pkpass con Content-Type corretto", async () => {
    stubAppleEnv();
    dbMock.ticket.findUnique.mockResolvedValue(activeTicket());
    const res = await appleRoute(req, params);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.apple.pkpass");
  });
});

describe("feature flag: senza env il modulo non esiste", () => {
  it("config: senza env i flag sono false", () => {
    expect(isAppleWalletConfigured()).toBe(false);
    expect(isGoogleWalletConfigured()).toBe(false);
  });

  it("config: con env i flag sono true", () => {
    stubAppleEnv();
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "123");
    vi.stubEnv("GOOGLE_WALLET_SA_KEY_BASE64", "e30=");
    expect(isAppleWalletConfigured()).toBe(true);
    expect(isGoogleWalletConfigured()).toBe(true);
  });

  it("endpoint senza env → 404, il DB non viene nemmeno interrogato", async () => {
    const [appleRes, googleRes] = await Promise.all([
      appleRoute(req, params),
      googleRoute(req, params),
    ]);
    expect(appleRes.status).toBe(404);
    expect(googleRes.status).toBe(404);
    expect(dbMock.ticket.findUnique).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST MANUALE della generazione firmata (serve il certificato vero):
// 1. Imposta le env APPLE_* in .env.local (vedi .env.example)
// 2. `pnpm dev`, apri la pagina di un ticket attivo da iPhone e tocca
//    "Add to Apple Wallet": il pass deve aprirsi in Wallet
// 3. Scansiona dal POS il QR DEL PASS: deve consumare il ticket esattamente
//    come il QR del sito
// 4. Per Google: env GOOGLE_*, tocca "Aggiungi a Google Wallet" da Android
//    e ripeti la scansione dal POS
// ─────────────────────────────────────────────────────────────────────────────
