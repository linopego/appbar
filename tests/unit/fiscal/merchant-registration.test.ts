import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Censimento dell'esercente presso il provider (fix 424 "Fiscal ID not
// registered"): auto-riparazione nell'adapter (UNA registrazione + UN nuovo
// tentativo), registerMerchant con segreti decifrati, persistenza dell'id
// configurazione via registerVenueMerchant.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    venue: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { OpenapiFiscalProvider } from "@/lib/fiscal/openapi-provider";
import { MockFiscalProvider } from "@/lib/fiscal/mock-provider";
import { registerVenueMerchant } from "@/lib/fiscal/emit";
import { encryptFiscalSecrets } from "@/lib/fiscal/crypto";
import { FiscalProviderError } from "@/lib/fiscal/types";

const NOT_REGISTERED_BODY = JSON.stringify({
  success: false,
  message: "Fiscal ID not found or not registered, use endpoint /IT_configurations to register it",
  error: 424,
});

const SALE_INPUT = {
  idempotencyKey: "doc-1",
  total: "10.00",
  lines: [{ description: "Birra", quantity: 2, unitPrice: "5.00", vatRate: "10.00" }],
  venueFiscalConfig: {} as Record<string, unknown>,
};

function response(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAPI_FISCAL_API_KEY", "test-key");
  vi.stubEnv("OPENAPI_FISCAL_SANDBOX", "true");
  vi.stubEnv("FISCAL_CONFIG_ENCRYPTION_KEY", "chiave-di-test");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenapiFiscalProvider — auto-riparazione del 424", () => {
  it("non registrato → registra (con segreti decifrati) → riemette con successo", async () => {
    const secrets = { username: "sandbox", password: "sandbox", pin: "sandbox" };
    const config = {
      fiscalId: "12345678901",
      encryptedSecrets: encryptFiscalSecrets(secrets),
    };

    fetchMock
      .mockResolvedValueOnce(response(404, NOT_REGISTERED_BODY)) // emissione: 424
      .mockResolvedValueOnce(response(200, { data: { id: "cfg-1" } })) // censimento
      .mockResolvedValueOnce(response(200, { data: { id: "rcpt-1", document_number: "0001" } })); // nuovo tentativo

    const provider = new OpenapiFiscalProvider();
    const result = await provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: config });

    expect(result.providerDocId).toBe("rcpt-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // La registrazione va su /IT-configurations con fiscal_id + credenziali
    const [registerUrl, registerInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(registerUrl).toContain("/IT-configurations");
    const registerBody = JSON.parse(String(registerInit.body));
    expect(registerBody.fiscal_id).toBe("12345678901");
    expect(registerBody.username).toBe("sandbox");
    expect(registerBody.pin).toBe("sandbox");
  });

  it("fallisce anche la registrazione → l'errore resta visibile, un solo giro", async () => {
    fetchMock
      .mockResolvedValueOnce(response(404, NOT_REGISTERED_BODY))
      .mockResolvedValueOnce(response(500, { message: "boom" }));

    const provider = new OpenapiFiscalProvider();
    await expect(
      provider.emitSaleDocument({
        ...SALE_INPUT,
        venueFiscalConfig: { fiscalId: "12345678901" },
      })
    ).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(2); // niente terzo tentativo di emissione
  });

  it("un errore diverso dal 424 NON scatena la registrazione", async () => {
    fetchMock.mockResolvedValueOnce(response(400, { message: "bad request" }));

    const provider = new OpenapiFiscalProvider();
    await expect(
      provider.emitSaleDocument({
        ...SALE_INPUT,
        venueFiscalConfig: { fiscalId: "12345678901" },
      })
    ).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("registerMerchant: fallback sul path con underscore se quello col trattino non esiste", async () => {
    fetchMock
      .mockResolvedValueOnce(response(404, { message: "Not Found" })) // /IT-configurations inesistente
      .mockResolvedValueOnce(response(200, { id: "cfg-2" })); // /IT_configurations

    const provider = new OpenapiFiscalProvider();
    const result = await provider.registerMerchant({ fiscalId: "12345678901" });

    expect(result.providerConfigurationId).toBe("cfg-2");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/IT_configurations");
  });

  it("registerMerchant senza fiscalId → errore definitivo senza chiamate", async () => {
    const provider = new OpenapiFiscalProvider();
    await expect(provider.registerMerchant({})).rejects.toBeInstanceOf(FiscalProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("MockFiscalProvider — scenario non registrato → registra → emetti ok", () => {
  it("l'emissione fallisce con 424 finché l'esercente non è censito, poi riesce", async () => {
    const provider = new MockFiscalProvider("not-registered");
    const config = { fiscalId: "12345678901" };

    await expect(
      provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: config })
    ).rejects.toMatchObject({ notRegistered: true });

    const registration = await provider.registerMerchant(config);
    expect(registration.providerConfigurationId).toBe("mock-config-12345678901");

    const result = await provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: config });
    expect(result.providerDocId).toBe("mock-doc-1");
    expect(provider.registerCalls).toHaveLength(1);
  });
});

describe("registerVenueMerchant — persistenza dell'id configurazione", () => {
  it("registra e salva providerConfigurationId dentro fiscalConfig", async () => {
    dbMock.venue.findUnique.mockResolvedValue({
      fiscalConfig: { fiscalId: "12345678901", encryptedSecrets: "..." },
    });
    dbMock.venue.update.mockResolvedValue({});
    const provider = new MockFiscalProvider("succeed");

    const outcome = await registerVenueMerchant("ven-1", provider);

    expect(outcome).toEqual({ ok: true, providerConfigurationId: "mock-config-12345678901" });
    const update = dbMock.venue.update.mock.calls[0]?.[0];
    expect(update?.data.fiscalConfig.configurationId).toBe("mock-config-12345678901");
    expect(update?.data.fiscalConfig.fiscalId).toBe("12345678901"); // config preservata
  });

  it("configurazione assente o senza fiscalId → errore 400 senza chiamare il provider", async () => {
    dbMock.venue.findUnique.mockResolvedValue({ fiscalConfig: null });
    const provider = new MockFiscalProvider("succeed");

    const outcome = await registerVenueMerchant("ven-1", provider);

    expect(outcome.ok).toBe(false);
    expect(provider.registerCalls).toHaveLength(0);
    expect(dbMock.venue.update).not.toHaveBeenCalled();
  });

  it("provider in errore → esito negativo, nessuna scrittura", async () => {
    dbMock.venue.findUnique.mockResolvedValue({ fiscalConfig: { fiscalId: "12345678901" } });
    const provider = new MockFiscalProvider("fail-permanent");

    const outcome = await registerVenueMerchant("ven-1", provider);

    expect(outcome.ok).toBe(false);
    expect(dbMock.venue.update).not.toHaveBeenCalled();
  });
});
