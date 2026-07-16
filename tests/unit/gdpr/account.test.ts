import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

// GDPR: consenso ToS al checkout (blocco server + tosAcceptedAt),
// cancellazione account (anonimizzazione, ticket VOIDED, blocco con rimborsi
// in corso, audit), export dei soli dati propri, POS che rifiuta VOIDED.

const { mockAuth, dbMock, stripeMock, mockCheckRateLimit } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  dbMock: {
    customer: { update: vi.fn(), findUnique: vi.fn() },
    customerAccount: { deleteMany: vi.fn() },
    customerSession: { deleteMany: vi.fn() },
    ticket: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    refund: { count: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), create: vi.fn() },
    orderItem: { createMany: vi.fn() },
    venue: { findUnique: vi.fn() },
    priceTier: { findMany: vi.fn() },
    adminAuditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  stripeMock: {
    checkout: { sessions: { create: vi.fn() } },
  },
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/stripe/client", () => ({ stripe: stripeMock }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  checkoutLimiter: null,
  dataExportLimiter: null,
}));

import { POST as deleteAccount } from "@/app/api/account/delete/route";
import { GET as exportData } from "@/app/api/account/export/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { computeTicketStatus } from "@/lib/tickets/status";

const CUSTOMER_ID = "cust-1";
const VALID_CUID = "cjld2cjxh0000qzrmn831i7rn";

function jsonRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: CUSTOMER_ID, email: "anna@example.com" } });
  mockCheckRateLimit.mockResolvedValue({ success: true });
  // $transaction esegue il callback passando il "tx" = dbMock stesso
  dbMock.$transaction.mockImplementation(async (cb: (tx: typeof dbMock) => unknown) => cb(dbMock));
  dbMock.ticket.updateMany.mockResolvedValue({ count: 2 });
  dbMock.customer.update.mockResolvedValue({});
  dbMock.customerAccount.deleteMany.mockResolvedValue({ count: 1 });
  dbMock.customerSession.deleteMany.mockResolvedValue({ count: 1 });
  dbMock.adminAuditLog.create.mockResolvedValue({});
});

describe("checkout: consenso ai Termini obbligatorio (server)", () => {
  it("senza tosAccepted → 422, nessun ordine creato", async () => {
    const res = await checkout(
      jsonRequest({ venueSlug: "casa-dei-gelsi", items: [{ priceTierId: VALID_CUID, quantity: 1 }] })
    );
    expect(res.status).toBe(422);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("con tosAccepted → ordine creato con tosAcceptedAt valorizzato", async () => {
    dbMock.venue.findUnique.mockResolvedValue({
      id: "venue-1",
      name: "La Casa dei Gelsi",
      organization: {
        id: "org-1",
        stripeAccountId: "acct_1",
        stripeChargesEnabled: true,
        feePercent: new Prisma.Decimal("5"),
        active: true,
      },
    });
    dbMock.priceTier.findMany.mockResolvedValue([
      { id: VALID_CUID, name: "Birra", price: new Prisma.Decimal("6.00") },
    ]);
    dbMock.order.create.mockResolvedValue({ id: "order-1" });
    dbMock.orderItem.createMany.mockResolvedValue({ count: 1 });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: "cs_123",
      url: "https://stripe.test/pay",
    });
    dbMock.order.update.mockResolvedValue({});

    const res = await checkout(
      jsonRequest({
        venueSlug: "casa-dei-gelsi",
        items: [{ priceTierId: VALID_CUID, quantity: 1 }],
        tosAccepted: true,
      })
    );
    expect(res.status).toBe(200);

    const created = dbMock.order.create.mock.calls[0][0].data;
    expect(created.tosAcceptedAt).toBeInstanceOf(Date);
  });
});

describe("cancellazione account (diritto all'oblio)", () => {
  it("anonimizza la PII, annulla i ticket attivi, scrive l'audit; ordini INTATTI", async () => {
    dbMock.refund.count.mockResolvedValue(0);

    const res = await deleteAccount();
    expect(res.status).toBe(200);

    // PII anonimizzata, non cancellata fisicamente
    const update = dbMock.customer.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: CUSTOMER_ID });
    expect(update.data.email).toBe(`deleted-${CUSTOMER_ID}@klink.invalid`);
    expect(update.data.firstName).toBeNull();
    expect(update.data.lastName).toBeNull();
    expect(update.data.image).toBeNull();
    expect(update.data.phone).toBeNull();

    // credenziali e sessioni eliminate
    expect(dbMock.customerAccount.deleteMany).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID },
    });
    expect(dbMock.customerSession.deleteMany).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID },
    });

    // ticket ATTIVI → VOIDED (gli altri stati restano storici)
    expect(dbMock.ticket.updateMany).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID, status: "ACTIVE" },
      data: { status: "VOIDED" },
    });

    // audit self-service
    const audit = dbMock.adminAuditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("CUSTOMER_ACCOUNT_DELETED");
    expect(audit.actorType).toBe("SYSTEM");
    expect(audit.payload).toMatchObject({ selfService: true });

    // ordini/transazioni MAI toccati
    expect(dbMock.order.update).not.toHaveBeenCalled();
    expect(dbMock.order.create).not.toHaveBeenCalled();
  });

  it("bloccata con richieste di rimborso PENDING → 409, nessuna modifica", async () => {
    dbMock.refund.count.mockResolvedValue(1);

    const res = await deleteAccount();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("PENDING_REFUNDS");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(dbMock.customer.update).not.toHaveBeenCalled();
  });

  it("il POS rifiuta i ticket VOIDED (mai più ACTIVE, nemmeno se non scaduti)", () => {
    const future = new Date(Date.now() + 86400_000);
    expect(computeTicketStatus({ status: "VOIDED", expiresAt: future })).toBe("VOIDED");
  });
});

describe("export dei propri dati", () => {
  it("interroga SOLO i dati dell'utente autenticato", async () => {
    dbMock.customer.findUnique.mockResolvedValue({ email: "anna@example.com" });

    const res = await exportData();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("klink-dati.json");

    expect(dbMock.customer.findUnique.mock.calls[0][0].where).toEqual({ id: CUSTOMER_ID });
    expect(dbMock.order.findMany.mock.calls[0][0].where).toEqual({ customerId: CUSTOMER_ID });
    expect(dbMock.ticket.findMany.mock.calls[0][0].where).toEqual({ customerId: CUSTOMER_ID });
    expect(dbMock.refund.findMany.mock.calls[0][0].where).toEqual({
      order: { customerId: CUSTOMER_ID },
    });
  });

  it("rate limit 1/ora → 429", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false });
    const res = await exportData();
    expect(res.status).toBe(429);
    expect(dbMock.customer.findUnique).not.toHaveBeenCalled();
  });

  it("non autenticato → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await exportData();
    expect(res.status).toBe(401);
  });
});
