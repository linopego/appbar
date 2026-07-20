import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@prisma/client";

// Test della macchina a stati del FiscalDocument (src/lib/fiscal/emit.ts):
// PENDING→CONFIRMED, retry con backoff, FAILED definitivo, precondizioni,
// idempotenza dell'accodamento, resilienza dei wrapper best-effort. DB mockato,
// provider = MockFiscalProvider.

const { dbMock } = vi.hoisted(() => {
  const dbMock = {
    order: { findUnique: vi.fn() },
    refund: { findUnique: vi.fn() },
    ticket: { findMany: vi.fn() },
    fiscalDocument: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { dbMock };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  FISCAL_MAX_ATTEMPTS,
  backoffMinutes,
  canEnableFiscal,
  enqueueAndTrySaleDocument,
  enqueueAndTryVoidDocument,
  enqueueSaleDocument,
  enqueueVoidDocument,
  isDueForRetry,
  processFiscalDocument,
  runFiscalRetryBatch,
} from "@/lib/fiscal/emit";
import { MockFiscalProvider } from "@/lib/fiscal/mock-provider";

const D = (v: string) => new Prisma.Decimal(v);

function pendingDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    orderId: "ord-1",
    type: "SALE",
    status: "PENDING",
    attempts: 0,
    total: D("10.00"),
    lines: [{ description: "Birra", quantity: 2, unitPrice: "5.00", vatRate: "10.00" }],
    venue: { fiscalConfig: { fiscalId: "12345678901" } },
    order: { totalAmount: D("10.00") },
    ...overrides,
  };
}

const orderRow = {
  id: "ord-1",
  totalAmount: D("10.00"),
  venue: { id: "ven-1", fiscalEnabled: true },
  items: [
    { tierName: "Birra", quantity: 2, unitPrice: D("5.00"), priceTier: { vatRate: D("10.00") } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAPI_FISCAL_API_KEY", "test-key");
  dbMock.fiscalDocument.update.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("canEnableFiscal — precondizioni di attivazione", () => {
  const config = { fiscalId: "12345678901" };

  it("bloccata se una fascia attiva non ha l'aliquota IVA (col nome nel motivo)", () => {
    const result = canEnableFiscal(
      [
        { name: "Birra", vatRate: D("10.00") },
        { name: "Drink", vatRate: null },
      ],
      config
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Drink");
  });

  it("bloccata senza fiscalConfig (a cura della piattaforma)", () => {
    const result = canEnableFiscal([{ name: "Birra", vatRate: D("10.00") }], null);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("piattaforma");
  });

  it("ok con aliquote complete e configurazione presente (anche senza fasce)", () => {
    expect(canEnableFiscal([{ name: "Birra", vatRate: D("10.00") }], config).ok).toBe(true);
    expect(canEnableFiscal([], config).ok).toBe(true);
  });
});

describe("backoff e maturità del retry", () => {
  it("backoff esponenziale con cap a 60 minuti", () => {
    expect(backoffMinutes(0)).toBe(1);
    expect(backoffMinutes(3)).toBe(8);
    expect(backoffMinutes(6)).toBe(60);
    expect(backoffMinutes(10)).toBe(60);
  });

  it("isDueForRetry rispetta il backoff sui tentativi già fatti", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    const twoMinAgo = new Date(now.getTime() - 2 * 60_000);
    // attempts 0 → backoff 1 min: maturo dopo 2 minuti
    expect(isDueForRetry({ attempts: 0, updatedAt: twoMinAgo }, now)).toBe(true);
    // attempts 3 → backoff 8 min: NON maturo dopo 2 minuti
    expect(isDueForRetry({ attempts: 3, updatedAt: twoMinAgo }, now)).toBe(false);
  });
});

describe("processFiscalDocument — macchina a stati", () => {
  it("PENDING → CONFIRMED su successo, con id/protocollo/pdf del provider", async () => {
    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc());
    const provider = new MockFiscalProvider("succeed");

    const outcome = await processFiscalDocument("doc-1", provider);

    expect(outcome).toBe("CONFIRMED");
    expect(provider.saleCalls).toHaveLength(1);
    expect(provider.saleCalls[0]?.idempotencyKey).toBe("doc-1");
    const update = dbMock.fiscalDocument.update.mock.calls[0]?.[0];
    expect(update?.data.status).toBe("CONFIRMED");
    expect(update?.data.providerDocId).toBe("mock-doc-1");
    expect(update?.data.lastError).toBeNull();
  });

  it("errore ritentabile → resta PENDING con attempts+1 e lastError", async () => {
    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc());
    const outcome = await processFiscalDocument("doc-1", new MockFiscalProvider("fail-retryable"));

    expect(outcome).toBe("PENDING");
    const update = dbMock.fiscalDocument.update.mock.calls[0]?.[0];
    expect(update?.data.status).toBe("PENDING");
    expect(update?.data.attempts).toBe(1);
    expect(update?.data.lastError).toContain("temporaneo");
  });

  it("errore definitivo → FAILED al primo colpo", async () => {
    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc());
    const outcome = await processFiscalDocument("doc-1", new MockFiscalProvider("fail-permanent"));

    expect(outcome).toBe("FAILED");
    expect(dbMock.fiscalDocument.update.mock.calls[0]?.[0]?.data.status).toBe("FAILED");
  });

  it("tentativi esauriti → FAILED anche con errore ritentabile", async () => {
    dbMock.fiscalDocument.findUnique.mockResolvedValue(
      pendingDoc({ attempts: FISCAL_MAX_ATTEMPTS - 1 })
    );
    const outcome = await processFiscalDocument("doc-1", new MockFiscalProvider("fail-retryable"));

    expect(outcome).toBe("FAILED");
    const update = dbMock.fiscalDocument.update.mock.calls[0]?.[0];
    expect(update?.data.status).toBe("FAILED");
    expect(update?.data.attempts).toBe(FISCAL_MAX_ATTEMPTS);
  });

  it("documento già CONFIRMED o FAILED → SKIPPED, provider mai chiamato", async () => {
    const provider = new MockFiscalProvider("succeed");
    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc({ status: "CONFIRMED" }));
    expect(await processFiscalDocument("doc-1", provider)).toBe("SKIPPED");
    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc({ status: "FAILED" }));
    expect(await processFiscalDocument("doc-1", provider)).toBe("SKIPPED");
    expect(provider.saleCalls).toHaveLength(0);
    expect(dbMock.fiscalDocument.update).not.toHaveBeenCalled();
  });

  it("righe senza aliquota → FAILED definitivo senza chiamare il provider", async () => {
    dbMock.fiscalDocument.findUnique.mockResolvedValue(
      pendingDoc({ lines: [{ description: "Birra", quantity: 1, unitPrice: "5.00", vatRate: "" }] })
    );
    const provider = new MockFiscalProvider("succeed");
    const outcome = await processFiscalDocument("doc-1", provider);

    expect(outcome).toBe("FAILED");
    expect(provider.saleCalls).toHaveLength(0);
  });

  it("VOID senza vendita confermata → errore ritentabile, resta PENDING", async () => {
    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc({ type: "VOID", total: D("5.00") }));
    dbMock.fiscalDocument.findFirst.mockResolvedValue(null); // nessuna SALE CONFIRMED
    const provider = new MockFiscalProvider("succeed");

    const outcome = await processFiscalDocument("doc-1", provider);

    expect(outcome).toBe("PENDING");
    expect(provider.voidCalls).toHaveLength(0);
  });

  it("VOID: rimborso totale → annullo (full=true), parziale → reso (full=false)", async () => {
    dbMock.fiscalDocument.findFirst.mockResolvedValue({ providerDocId: "prov-sale-1" });
    const provider = new MockFiscalProvider("succeed");

    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc({ type: "VOID", total: D("10.00") }));
    await processFiscalDocument("doc-1", provider);
    expect(provider.voidCalls[0]?.full).toBe(true);
    expect(provider.voidCalls[0]?.originalProviderDocId).toBe("prov-sale-1");

    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc({ type: "VOID", total: D("4.00") }));
    await processFiscalDocument("doc-1", provider);
    expect(provider.voidCalls[1]?.full).toBe(false);
  });
});

describe("enqueueSaleDocument — idempotenza", () => {
  it("modulo non configurato → null senza toccare il DB", async () => {
    vi.stubEnv("OPENAPI_FISCAL_API_KEY", "");
    expect(await enqueueSaleDocument("ord-1")).toBeNull();
    expect(dbMock.order.findUnique).not.toHaveBeenCalled();
  });

  it("venue con fiscale spento → null, nessun documento creato", async () => {
    dbMock.order.findUnique.mockResolvedValue({
      ...orderRow,
      venue: { id: "ven-1", fiscalEnabled: false },
    });
    expect(await enqueueSaleDocument("ord-1")).toBeNull();
    expect(dbMock.fiscalDocument.create).not.toHaveBeenCalled();
  });

  it("crea il documento PENDING con lo snapshot delle righe (aliquota inclusa)", async () => {
    dbMock.order.findUnique.mockResolvedValue(orderRow);
    dbMock.fiscalDocument.findFirst.mockResolvedValue(null);
    dbMock.fiscalDocument.create.mockResolvedValue({ id: "doc-1" });

    const id = await enqueueSaleDocument("ord-1");

    expect(id).toBe("doc-1");
    const create = dbMock.fiscalDocument.create.mock.calls[0]?.[0];
    expect(create?.data.type).toBe("SALE");
    expect(create?.data.status).toBe("PENDING");
    expect(create?.data.lines).toEqual([
      { description: "Birra", quantity: 2, unitPrice: "5.00", vatRate: "10.00" },
    ]);
  });

  it("doppio enqueue → un solo documento: il secondo restituisce l'esistente", async () => {
    dbMock.order.findUnique.mockResolvedValue(orderRow);
    dbMock.fiscalDocument.findFirst.mockResolvedValue({ id: "doc-esistente" });

    expect(await enqueueSaleDocument("ord-1")).toBe("doc-esistente");
    expect(dbMock.fiscalDocument.create).not.toHaveBeenCalled();
  });

  it("gara sull'indice unico (P2002) → restituisce il documento dell'altra richiesta", async () => {
    dbMock.order.findUnique.mockResolvedValue(orderRow);
    dbMock.fiscalDocument.findFirst
      .mockResolvedValueOnce(null) // primo check: non esiste ancora
      .mockResolvedValueOnce({ id: "doc-vincitore" }); // rilettura dopo P2002
    dbMock.fiscalDocument.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "5.22.0",
      })
    );

    expect(await enqueueSaleDocument("ord-1")).toBe("doc-vincitore");
  });
});

describe("enqueueVoidDocument — storno su rimborso", () => {
  const refundRow = {
    id: "ref-1",
    amount: D("5.00"),
    ticketIds: ["t1"],
    order: {
      id: "ord-1",
      totalAmount: D("10.00"),
      venue: { id: "ven-1", fiscalEnabled: true },
      items: [
        {
          priceTierId: "tier-1",
          tierName: "Birra",
          unitPrice: D("5.00"),
          priceTier: { vatRate: D("10.00") },
        },
      ],
    },
  };

  it("senza vendita CONFIRMED da stornare → null (niente storno orfano)", async () => {
    dbMock.refund.findUnique.mockResolvedValue(refundRow);
    dbMock.fiscalDocument.findFirst.mockResolvedValue(null);

    expect(await enqueueVoidDocument("ref-1")).toBeNull();
    expect(dbMock.fiscalDocument.create).not.toHaveBeenCalled();
  });

  it("crea il VOID con le righe dei ticket rimborsati raggruppate per fascia", async () => {
    dbMock.refund.findUnique.mockResolvedValue(refundRow);
    dbMock.fiscalDocument.findFirst.mockResolvedValue({ id: "sale-1" });
    dbMock.fiscalDocument.findUnique.mockResolvedValue(null); // nessun VOID per questo refund
    dbMock.ticket.findMany.mockResolvedValue([{ priceTierId: "tier-1" }]);
    dbMock.fiscalDocument.create.mockResolvedValue({ id: "void-1" });

    const id = await enqueueVoidDocument("ref-1");

    expect(id).toBe("void-1");
    const create = dbMock.fiscalDocument.create.mock.calls[0]?.[0];
    expect(create?.data.type).toBe("VOID");
    expect(create?.data.refundId).toBe("ref-1");
    expect(create?.data.lines).toEqual([
      { description: "Birra", quantity: 1, unitPrice: "5.00", vatRate: "10.00" },
    ]);
  });

  it("stesso rimborso accodato due volte → un solo documento", async () => {
    dbMock.refund.findUnique.mockResolvedValue(refundRow);
    dbMock.fiscalDocument.findFirst.mockResolvedValue({ id: "sale-1" });
    dbMock.fiscalDocument.findUnique.mockResolvedValue({ id: "void-esistente" });

    expect(await enqueueVoidDocument("ref-1")).toBe("void-esistente");
    expect(dbMock.fiscalDocument.create).not.toHaveBeenCalled();
  });
});

describe("wrapper best-effort — il flusso di vendita/rimborso non si ferma MAI", () => {
  it("enqueueAndTrySaleDocument ingoia anche un DB irraggiungibile", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.order.findUnique.mockRejectedValue(new Error("db down"));

    await expect(enqueueAndTrySaleDocument("ord-1")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("enqueueAndTryVoidDocument ingoia qualunque errore", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.refund.findUnique.mockRejectedValue(new Error("db down"));

    await expect(enqueueAndTryVoidDocument("ref-1")).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});

describe("runFiscalRetryBatch — cron di recupero", () => {
  it("lavora solo i documenti maturi per il backoff e conta gli esiti", async () => {
    const now = Date.now();
    dbMock.fiscalDocument.findMany.mockResolvedValue([
      // maturo: attempts 0 (backoff 1 min), aggiornato 5 minuti fa
      { id: "doc-due", attempts: 0, updatedAt: new Date(now - 5 * 60_000) },
      // NON maturo: attempts 5 (backoff 32 min), aggiornato 5 minuti fa
      { id: "doc-not-due", attempts: 5, updatedAt: new Date(now - 5 * 60_000) },
    ]);
    dbMock.fiscalDocument.findUnique.mockResolvedValue(pendingDoc({ id: "doc-due" }));
    const provider = new MockFiscalProvider("succeed");

    const result = await runFiscalRetryBatch(25, provider);

    expect(result).toEqual({ processed: 1, confirmed: 1, failed: 0 });
    expect(provider.saleCalls).toHaveLength(1);
  });
});
