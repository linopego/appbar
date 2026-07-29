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
      name: "Bar Luna Srl",
      email: "fiscale@barluna.it",
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
    expect(registerBody.name).toBe("Bar Luna Srl");
    expect(registerBody.email).toBe("fiscale@barluna.it");
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
        venueFiscalConfig: { fiscalId: "12345678901", name: "Bar Luna Srl" },
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
    const result = await provider.registerMerchant({ fiscalId: "12345678901", name: "Bar Luna Srl" });

    expect(result.providerConfigurationId).toBe("cfg-2");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/IT_configurations");
  });

  it("registerMerchant senza fiscalId → errore definitivo senza chiamate", async () => {
    const provider = new OpenapiFiscalProvider();
    await expect(provider.registerMerchant({})).rejects.toBeInstanceOf(FiscalProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registerMerchant senza denominazione → errore chiaro senza chiamate al provider", async () => {
    const provider = new OpenapiFiscalProvider();
    await expect(provider.registerMerchant({ fiscalId: "12345678901" })).rejects.toThrow(
      /denominazione/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("OpenapiFiscalProvider — 'fiscal_id already exists' (422/112) è successo idempotente", () => {
  const ALREADY_EXISTS_BODY = JSON.stringify({
    message: "This fiscal_id already exists",
    error: 112,
  });
  const CONFIG = { fiscalId: "12345678901", name: "Bar Luna Srl" };

  it("esiste già → PATCH di allineamento anagrafica → id dalla risposta", async () => {
    fetchMock
      .mockResolvedValueOnce(response(422, ALREADY_EXISTS_BODY)) // POST
      .mockResolvedValueOnce(response(200, { data: { id: "cfg-esistente" } })); // PATCH

    const provider = new OpenapiFiscalProvider();
    const result = await provider.registerMerchant(CONFIG);

    expect(result.providerConfigurationId).toBe("cfg-esistente");
    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(patchInit.method).toBe("PATCH");
    expect(patchUrl).toContain("/IT-configurations/12345678901");
    // L'anagrafica attuale viene riallineata (fiscal_id sta nel path)
    const patchBody = JSON.parse(String(patchInit.body));
    expect(patchBody.name).toBe("Bar Luna Srl");
    expect(patchBody.fiscal_id).toBeUndefined();
  });

  it("PATCH fallito → GET della configurazione esistente per l'id", async () => {
    fetchMock
      .mockResolvedValueOnce(response(422, ALREADY_EXISTS_BODY)) // POST
      .mockResolvedValueOnce(response(500, { message: "boom" })) // PATCH
      .mockResolvedValueOnce(response(200, { data: { configuration_id: "cfg-9" } })); // GET

    const provider = new OpenapiFiscalProvider();
    const result = await provider.registerMerchant(CONFIG);

    expect(result.providerConfigurationId).toBe("cfg-9");
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("GET");
  });

  it("anche PATCH e GET falliti → successo con fiscal_id come id (chiave del provider)", async () => {
    fetchMock
      .mockResolvedValueOnce(response(422, ALREADY_EXISTS_BODY)) // POST
      .mockResolvedValueOnce(response(500, { message: "boom" })) // PATCH
      .mockResolvedValueOnce(response(500, { message: "boom" })); // GET

    const provider = new OpenapiFiscalProvider();
    const result = await provider.registerMerchant(CONFIG);

    expect(result.providerConfigurationId).toBe("12345678901");
  });

  it("idempotente: N chiamate producono sempre 'registrato con ID valorizzato'", async () => {
    // Prima chiamata: creazione ok; seconda: already exists → recupero
    fetchMock
      .mockResolvedValueOnce(response(200, { data: { id: "cfg-1" } })) // POST 1
      .mockResolvedValueOnce(response(422, ALREADY_EXISTS_BODY)) // POST 2
      .mockResolvedValueOnce(response(200, { data: { id: "cfg-1" } })); // PATCH 2

    const provider = new OpenapiFiscalProvider();
    const first = await provider.registerMerchant(CONFIG);
    const second = await provider.registerMerchant(CONFIG);

    expect(first.providerConfigurationId).toBe("cfg-1");
    expect(second.providerConfigurationId).toBe("cfg-1");
  });
});

describe("OpenapiFiscalProvider — servizio receipts non abilitato (400/174)", () => {
  const RECEIPTS_DISABLED_BODY = JSON.stringify({
    message: "receipts service is not enabled for the user, set receipts to true in configuration",
    error: 174,
  });
  const ALREADY_EXISTS_BODY = JSON.stringify({
    message: "This fiscal_id already exists",
    error: 112,
  });
  const CONFIG = { fiscalId: "12345678901", name: "Bar Luna Srl" };

  it("la creazione della configurazione include receipts:true", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { data: { id: "cfg-1" } }));

    const provider = new OpenapiFiscalProvider();
    await provider.registerMerchant(CONFIG);

    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.receipts).toBe(true);
  });

  it("emissione 174 → auto-riparazione: UPDATE della config esistente con receipts:true → riemette ok", async () => {
    fetchMock
      .mockResolvedValueOnce(response(400, RECEIPTS_DISABLED_BODY)) // emissione: 174
      .mockResolvedValueOnce(response(422, ALREADY_EXISTS_BODY)) // POST config: esiste già
      .mockResolvedValueOnce(response(200, { data: { id: "cfg-1" } })) // PATCH con receipts:true
      .mockResolvedValueOnce(response(200, { data: { id: "rcpt-2" } })); // nuovo tentativo

    const provider = new OpenapiFiscalProvider();
    const result = await provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: CONFIG });

    expect(result.providerDocId).toBe("rcpt-2");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // L'UPDATE imposta il flag del servizio scontrini, non recupera solo l'id
    const [patchUrl, patchInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(patchInit.method).toBe("PATCH");
    expect(patchUrl).toContain("/IT-configurations/12345678901");
    expect(JSON.parse(String(patchInit.body)).receipts).toBe(true);
  });

  it("174 con riparazione fallita → l'errore resta visibile, un solo giro", async () => {
    fetchMock
      .mockResolvedValueOnce(response(400, RECEIPTS_DISABLED_BODY)) // emissione
      .mockResolvedValueOnce(response(500, { message: "boom" })); // POST config fallisce

    const provider = new OpenapiFiscalProvider();
    await expect(
      provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: CONFIG })
    ).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("MockFiscalProvider — scenario non registrato → registra → emetti ok", () => {
  it("l'emissione fallisce con 424 finché l'esercente non è censito, poi riesce", async () => {
    const provider = new MockFiscalProvider("not-registered");
    const config = { fiscalId: "12345678901", name: "Bar Luna Srl" };

    await expect(
      provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: config })
    ).rejects.toMatchObject({ notRegistered: true });

    const registration = await provider.registerMerchant(config);
    expect(registration.providerConfigurationId).toBe("mock-config-12345678901");

    const result = await provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: config });
    expect(result.providerDocId).toBe("mock-doc-1");
    expect(provider.registerCalls).toHaveLength(1);
  });

  it("config esistente senza receipts → update → emetti ok", async () => {
    const provider = new MockFiscalProvider("receipts-disabled");
    const config = { fiscalId: "12345678901", name: "Bar Luna Srl" };

    await expect(
      provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: config })
    ).rejects.toMatchObject({ receiptsNotEnabled: true });

    const update = await provider.registerMerchant(config);
    expect(update.providerConfigurationId).toBe("existing-config-12345678901");

    const result = await provider.emitSaleDocument({ ...SALE_INPUT, venueFiscalConfig: config });
    expect(result.providerDocId).toBe("mock-doc-1");
  });
});

describe("registerVenueMerchant — persistenza dell'id configurazione", () => {
  it("mock 'esiste già' → recupera l'ID esistente e lo persiste (stato Registrato)", async () => {
    dbMock.venue.findUnique.mockResolvedValue({
      fiscalConfig: { fiscalId: "12345678901", name: "Bar Luna Srl" },
    });
    dbMock.venue.update.mockResolvedValue({});
    const provider = new MockFiscalProvider("already-exists");

    const outcome = await registerVenueMerchant("ven-1", provider);

    expect(outcome).toEqual({ ok: true, providerConfigurationId: "existing-config-12345678901" });
    const update = dbMock.venue.update.mock.calls[0]?.[0];
    expect(update?.data.fiscalConfig.configurationId).toBe("existing-config-12345678901");
  });

  it("registra e salva providerConfigurationId dentro fiscalConfig", async () => {
    dbMock.venue.findUnique.mockResolvedValue({
      fiscalConfig: { fiscalId: "12345678901", name: "Bar Luna Srl", encryptedSecrets: "..." },
    });
    dbMock.venue.update.mockResolvedValue({});
    const provider = new MockFiscalProvider("succeed");

    const outcome = await registerVenueMerchant("ven-1", provider);

    expect(outcome).toEqual({ ok: true, providerConfigurationId: "mock-config-12345678901" });
    const update = dbMock.venue.update.mock.calls[0]?.[0];
    expect(update?.data.fiscalConfig.configurationId).toBe("mock-config-12345678901");
    expect(update?.data.fiscalConfig.fiscalId).toBe("12345678901"); // config preservata
    expect(update?.data.fiscalConfig.name).toBe("Bar Luna Srl");
  });

  it("configurazione senza denominazione → errore chiaro senza chiamare il provider", async () => {
    dbMock.venue.findUnique.mockResolvedValue({ fiscalConfig: { fiscalId: "12345678901" } });
    const provider = new MockFiscalProvider("succeed");

    const outcome = await registerVenueMerchant("ven-1", provider);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("Denominazione");
    expect(provider.registerCalls).toHaveLength(0);
    expect(dbMock.venue.update).not.toHaveBeenCalled();
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
    dbMock.venue.findUnique.mockResolvedValue({
      fiscalConfig: { fiscalId: "12345678901", name: "Bar Luna Srl" },
    });
    const provider = new MockFiscalProvider("fail-permanent");

    const outcome = await registerVenueMerchant("ven-1", provider);

    expect(outcome.ok).toBe(false);
    expect(dbMock.venue.update).not.toHaveBeenCalled();
  });
});
