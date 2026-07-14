import { describe, it, expect, vi, beforeEach } from "vitest";

// Test della macchina a stati del rimborso (src/lib/refunds/process.ts):
// claim atomico, rientranza PROCESSING/FAILED, TICKETS_CHANGED, idempotency
// key Stripe, transizione a FAILED su errore Stripe. DB e Stripe mockati.

const { tx, dbMock, stripeCreate } = vi.hoisted(() => {
  const tx = {
    refund: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    ticket: { updateMany: vi.fn(), count: vi.fn() },
    order: { update: vi.fn() },
    adminAuditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const dbMock = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    refund: { update: vi.fn() },
  };
  const stripeCreate = vi.fn();
  return { tx, dbMock, stripeCreate };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { refunds: { create: stripeCreate } },
}));

import {
  processRefund,
  getNonRefundableTicketIds,
  CLAIMABLE_STATUSES,
  type LockedTicket,
} from "@/lib/refunds/process";

const FUTURE = new Date(Date.now() + 7 * 86400000);
const PAST = new Date(Date.now() - 1000);

const ACTOR = { processedBy: "op-1", processedByType: "OPERATOR" as const };

function mockHappyPath() {
  tx.refund.updateMany.mockResolvedValue({ count: 1 });
  tx.refund.findUniqueOrThrow.mockResolvedValue({
    id: "ref-1",
    amount: "16.00",
    ticketIds: ["t1", "t2"],
    order: { id: "o1", stripePaymentId: "pi_123", venue: { organizationId: "org-1" } },
  });
  tx.$queryRaw.mockResolvedValue([
    { id: "t1", status: "ACTIVE", expiresAt: FUTURE },
    { id: "t2", status: "ACTIVE", expiresAt: FUTURE },
  ] satisfies LockedTicket[]);
  stripeCreate.mockResolvedValue({ id: "re_1" });
  tx.ticket.updateMany.mockResolvedValue({ count: 2 });
  tx.ticket.count.mockResolvedValue(0);
  tx.refund.update.mockResolvedValue({});
  tx.order.update.mockResolvedValue({});
  tx.adminAuditLog.create.mockResolvedValue({});
  dbMock.refund.update.mockResolvedValue({});
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHappyPath();
});

describe("claim atomico", () => {
  it("PENDING → PROCESSING: il claim usa updateMany sugli stati claimabili", async () => {
    const result = await processRefund({ refundId: "ref-1", actor: ACTOR });

    expect(result.ok).toBe(true);
    const claimArgs = tx.refund.updateMany.mock.calls[0][0];
    expect(claimArgs.where.id).toBe("ref-1");
    expect(claimArgs.where.status.in).toEqual(["PENDING", "PROCESSING", "FAILED"]);
    expect(claimArgs.data.status).toBe("PROCESSING");
  });

  it("secondo claim concorrente rifiutato: count 0 → ALREADY_PROCESSED, Stripe MAI chiamato", async () => {
    tx.refund.updateMany.mockResolvedValue({ count: 0 });

    const result = await processRefund({ refundId: "ref-1", actor: ACTOR });

    expect(result).toEqual({ ok: false, code: "ALREADY_PROCESSED" });
    expect(stripeCreate).not.toHaveBeenCalled();
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("rientranza: PROCESSING e FAILED sono negli stati claimabili", () => {
    // Un crash tra Stripe e finalizzazione (PROCESSING) o un errore Stripe
    // (FAILED) devono poter essere ripresi da una nuova approvazione.
    expect(CLAIMABLE_STATUSES).toContain("PROCESSING");
    expect(CLAIMABLE_STATUSES).toContain("FAILED");
    expect(CLAIMABLE_STATUSES).toContain("PENDING");
    expect(CLAIMABLE_STATUSES).not.toContain("COMPLETED");
    expect(CLAIMABLE_STATUSES).not.toContain("REJECTED");
  });
});

describe("verifica ticket (TICKETS_CHANGED)", () => {
  it("ticket CONSUMED tra richiesta e approvazione → TICKETS_CHANGED, refund torna PENDING, Stripe MAI chiamato", async () => {
    tx.$queryRaw.mockResolvedValue([
      { id: "t1", status: "CONSUMED", expiresAt: FUTURE },
      { id: "t2", status: "ACTIVE", expiresAt: FUTURE },
    ]);

    const result = await processRefund({ refundId: "ref-1", actor: ACTOR });

    expect(result).toEqual({
      ok: false,
      code: "TICKETS_CHANGED",
      invalidTicketIds: ["t1"],
    });
    expect(stripeCreate).not.toHaveBeenCalled();
    // rollback dello stato: PROCESSING → PENDING
    const revert = tx.refund.update.mock.calls[0][0];
    expect(revert.where.id).toBe("ref-1");
    expect(revert.data.status).toBe("PENDING");
  });

  it("ticket scaduto → TICKETS_CHANGED", async () => {
    tx.$queryRaw.mockResolvedValue([
      { id: "t1", status: "ACTIVE", expiresAt: PAST },
      { id: "t2", status: "ACTIVE", expiresAt: FUTURE },
    ]);

    const result = await processRefund({ refundId: "ref-1", actor: ACTOR });

    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "TICKETS_CHANGED") {
      expect(result.invalidTicketIds).toEqual(["t1"]);
    } else {
      expect.fail("atteso TICKETS_CHANGED");
    }
  });
});

describe("Stripe (fase 2)", () => {
  it("usa l'idempotency key refund-{id}: retry e doppie esecuzioni non duplicano il rimborso", async () => {
    await processRefund({ refundId: "ref-1", actor: ACTOR });

    expect(stripeCreate).toHaveBeenCalledOnce();
    const [payload, options] = stripeCreate.mock.calls[0];
    expect(payload).toEqual({ payment_intent: "pi_123", amount: 1600 });
    expect(options).toEqual({ idempotencyKey: "refund-ref-1" });
  });

  it("errore Stripe → refund FAILED con errorMessage, risultato STRIPE_ERROR", async () => {
    stripeCreate.mockRejectedValue(new Error("card_declined"));

    const result = await processRefund({ refundId: "ref-1", actor: ACTOR });

    expect(result).toEqual({ ok: false, code: "STRIPE_ERROR", message: "card_declined" });
    const failUpdate = dbMock.refund.update.mock.calls[0][0];
    expect(failUpdate.where.id).toBe("ref-1");
    expect(failUpdate.data.status).toBe("FAILED");
    expect(failUpdate.data.errorMessage).toBe("card_declined");
    // la finalizzazione non deve girare
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("ordine senza stripePaymentId: nessuna chiamata Stripe, refund APPROVED", async () => {
    tx.refund.findUniqueOrThrow.mockResolvedValue({
      id: "ref-1",
      amount: "16.00",
      ticketIds: ["t1", "t2"],
      order: { id: "o1", stripePaymentId: null, venue: { organizationId: "org-1" } },
    });

    const result = await processRefund({ refundId: "ref-1", actor: ACTOR });

    expect(result.ok).toBe(true);
    expect(stripeCreate).not.toHaveBeenCalled();
    const finalize = tx.refund.update.mock.calls[0][0];
    expect(finalize.data.status).toBe("APPROVED");
  });
});

describe("finalizzazione (fase 3)", () => {
  it("ticket → REFUNDED solo se ancora ACTIVE, refund → COMPLETED, audit sempre scritto", async () => {
    const result = await processRefund({ refundId: "ref-1", actor: ACTOR });

    expect(result.ok).toBe(true);

    const ticketUpdate = tx.ticket.updateMany.mock.calls[0][0];
    expect(ticketUpdate.where.id.in).toEqual(["t1", "t2"]);
    expect(ticketUpdate.where.status).toBe("ACTIVE"); // guardia anti-doppione
    expect(ticketUpdate.data.status).toBe("REFUNDED");

    const finalize = tx.refund.update.mock.calls[0][0];
    expect(finalize.data.status).toBe("COMPLETED");
    expect(finalize.data.stripeRefundId).toBe("re_1");
    expect(finalize.data.errorMessage).toBeNull();
    expect(finalize.data.processedBy).toBe("op-1");
    expect(finalize.data.processedByType).toBe("OPERATOR");

    // audit SEMPRE, anche per i manager (actorType OPERATOR)
    const audit = tx.adminAuditLog.create.mock.calls[0][0];
    expect(audit.data.organizationId).toBe("org-1");
    expect(audit.data.actorType).toBe("OPERATOR");
    expect(audit.data.operatorId).toBe("op-1");
    expect(audit.data.adminUserId).toBeUndefined();
    expect(audit.data.action).toBe("REFUND_APPROVED");
    expect(audit.data.targetType).toBe("Refund");
    expect(audit.data.targetId).toBe("ref-1");
    expect(audit.data.payload).toEqual({
      amount: "16.00",
      orderId: "o1",
      ticketIds: ["t1", "t2"],
    });
  });

  it("attore super-admin → audit con actorType ADMIN_USER e adminUserId", async () => {
    await processRefund({
      refundId: "ref-1",
      actor: { processedBy: "admin-9", processedByType: "ADMIN_USER" },
    });

    const audit = tx.adminAuditLog.create.mock.calls[0][0];
    expect(audit.data.actorType).toBe("ADMIN_USER");
    expect(audit.data.adminUserId).toBe("admin-9");
    expect(audit.data.operatorId).toBeUndefined();
  });

  it("nessun ticket ACTIVE residuo → ordine REFUNDED; con residui → PARTIALLY_REFUNDED", async () => {
    tx.ticket.count.mockResolvedValue(0);
    await processRefund({ refundId: "ref-1", actor: ACTOR });
    expect(tx.order.update.mock.calls[0][0].data.status).toBe("REFUNDED");

    vi.clearAllMocks();
    mockHappyPath();
    tx.ticket.count.mockResolvedValue(3);
    await processRefund({ refundId: "ref-1", actor: ACTOR });
    expect(tx.order.update.mock.calls[0][0].data.status).toBe("PARTIALLY_REFUNDED");
  });
});

describe("getNonRefundableTicketIds (pure)", () => {
  const now = new Date("2026-07-14T12:00:00Z");
  const future = new Date("2026-08-01T00:00:00Z");
  const past = new Date("2026-07-01T00:00:00Z");

  it("tutti ACTIVE e non scaduti → nessun invalido", () => {
    const tickets: LockedTicket[] = [
      { id: "a", status: "ACTIVE", expiresAt: future },
      { id: "b", status: "ACTIVE", expiresAt: future },
    ];
    expect(getNonRefundableTicketIds(tickets, ["a", "b"], now)).toEqual([]);
  });

  it("CONSUMED → invalido", () => {
    const tickets: LockedTicket[] = [
      { id: "a", status: "CONSUMED", expiresAt: future },
      { id: "b", status: "ACTIVE", expiresAt: future },
    ];
    expect(getNonRefundableTicketIds(tickets, ["a", "b"], now)).toEqual(["a"]);
  });

  it("REFUNDED → invalido", () => {
    const tickets: LockedTicket[] = [{ id: "a", status: "REFUNDED", expiresAt: future }];
    expect(getNonRefundableTicketIds(tickets, ["a"], now)).toEqual(["a"]);
  });

  it("scaduto (expiresAt <= now) → invalido", () => {
    const tickets: LockedTicket[] = [
      { id: "a", status: "ACTIVE", expiresAt: past },
      { id: "b", status: "ACTIVE", expiresAt: now }, // esattamente ora = scaduto
    ];
    expect(getNonRefundableTicketIds(tickets, ["a", "b"], now)).toEqual(["a", "b"]);
  });

  it("ticket mancante dal lock (id inesistente) → invalido", () => {
    const tickets: LockedTicket[] = [{ id: "a", status: "ACTIVE", expiresAt: future }];
    expect(getNonRefundableTicketIds(tickets, ["a", "ghost"], now)).toEqual(["ghost"]);
  });
});
