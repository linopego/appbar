import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";

// PRINCIPIO NON NEGOZIABILE del modulo fiscale: un ordine pagato produce
// SEMPRE ticket ed email, anche col provider fiscale irraggiungibile.
// Qui il webhook checkout.session.completed gira col fiscale "giù" (fetch
// che fallisce a livello rete): i ticket vengono creati, il documento resta
// PENDING e sarà ripreso dal cron.

const { tx, dbMock, sendEmailMock } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    order: { update: vi.fn() },
    orderItem: { findMany: vi.fn() },
    ticket: { findMany: vi.fn(), createMany: vi.fn() },
  };
  const dbMock = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    order: { findUnique: vi.fn() },
    fiscalDocument: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const sendEmailMock = vi.fn();
  return { tx, dbMock, sendEmailMock };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/email/order-confirmation", () => ({
  sendOrderConfirmationEmail: sendEmailMock,
}));

import { handleCheckoutCompleted } from "@/lib/stripe/handlers/checkout-completed";

const D = (v: string) => new Prisma.Decimal(v);

const event = {
  id: "evt_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      payment_intent: "pi_1",
      metadata: { orderId: "ord-1" },
    },
  },
} as unknown as Stripe.Event;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAPI_FISCAL_API_KEY", "test-key");
  // Provider fiscale irraggiungibile: ogni fetch fallisce a livello rete
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  // Transazione: ordine PENDING → PAID + creazione ticket
  tx.$queryRaw.mockResolvedValue([
    { id: "ord-1", status: "PENDING", venueId: "ven-1", customerId: "cus-1" },
  ]);
  tx.order.update.mockResolvedValue({});
  tx.orderItem.findMany.mockResolvedValue([
    { orderId: "ord-1", priceTierId: "tier-1", quantity: 2 },
  ]);
  tx.ticket.findMany
    .mockResolvedValueOnce([]) // nessun ticket pre-esistente
    .mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }]); // dopo la createMany
  tx.ticket.createMany.mockResolvedValue({ count: 2 });
  sendEmailMock.mockResolvedValue(undefined);

  // Accodamento fiscale post-commit
  dbMock.order.findUnique.mockResolvedValue({
    id: "ord-1",
    totalAmount: D("10.00"),
    venue: { id: "ven-1", fiscalEnabled: true },
    items: [
      { tierName: "Birra", quantity: 2, unitPrice: D("5.00"), priceTier: { vatRate: D("10.00") } },
    ],
  });
  dbMock.fiscalDocument.findFirst.mockResolvedValue(null);
  dbMock.fiscalDocument.create.mockResolvedValue({ id: "doc-1" });
  dbMock.fiscalDocument.findUnique.mockResolvedValue({
    id: "doc-1",
    orderId: "ord-1",
    type: "SALE",
    status: "PENDING",
    attempts: 0,
    total: D("10.00"),
    lines: [{ description: "Birra", quantity: 2, unitPrice: "5.00", vatRate: "10.00" }],
    venue: { fiscalConfig: { fiscalId: "12345678901" } },
    order: { totalAmount: D("10.00") },
  });
  dbMock.fiscalDocument.update.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ordine pagato con provider fiscale giù", () => {
  it("ticket creati, email inviata, webhook OK; il documento resta PENDING per il cron", async () => {
    await expect(handleCheckoutCompleted(event)).resolves.toBeUndefined();

    // La vendita è completa
    expect(tx.ticket.createMany).toHaveBeenCalledOnce();
    expect(tx.order.update.mock.calls[0]?.[0]?.data.status).toBe("PAID");
    expect(sendEmailMock).toHaveBeenCalledOnce();

    // Il documento è stato accodato e il tentativo fallito lo lascia PENDING
    expect(dbMock.fiscalDocument.create.mock.calls[0]?.[0]?.data.status).toBe("PENDING");
    const update = dbMock.fiscalDocument.update.mock.calls[0]?.[0];
    expect(update?.data.status).toBe("PENDING"); // errore di rete = ritentabile
    expect(update?.data.attempts).toBe(1);
  });

  it("anche con l'accodamento fiscale che esplode, il webhook non propaga errori", async () => {
    dbMock.order.findUnique.mockRejectedValue(new Error("db down"));

    await expect(handleCheckoutCompleted(event)).resolves.toBeUndefined();
    expect(tx.ticket.createMany).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });
});
