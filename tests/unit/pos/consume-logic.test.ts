import { describe, expect, it } from "vitest";

// Replicate the consume transaction logic for unit testing
interface FakeTicket {
  id: string;
  status: string;
  venueId: string;
  expiresAt: Date;
  priceTierId: string;
  consumedAt: Date | null;
  consumedBy: string | null;
}

interface FakePriceTier {
  id: string;
  name: string;
  price: { toString(): string };
}

interface FakeOperator {
  id: string;
  name: string;
}

type ConsumeResult =
  | { ok: true; consumedAt: Date; tier: FakePriceTier }
  | { ok: false; code: string; consumedAt?: Date | null; consumedByName?: string | null };

async function simulateConsume(
  ticket: FakeTicket | null,
  operatorVenueId: string,
  operatorId: string,
  tier: FakePriceTier,
  operator?: FakeOperator
): Promise<ConsumeResult> {
  if (!ticket) return { ok: false, code: "TICKET_NOT_FOUND" };
  if (ticket.venueId !== operatorVenueId) return { ok: false, code: "WRONG_VENUE" };
  if (ticket.expiresAt < new Date()) return { ok: false, code: "EXPIRED" };
  if (ticket.status === "CONSUMED") {
    return {
      ok: false,
      code: "ALREADY_CONSUMED",
      consumedAt: ticket.consumedAt,
      consumedByName: operator?.name ?? null,
    };
  }
  if (ticket.status === "REFUNDED") return { ok: false, code: "REFUNDED" };
  if (ticket.status !== "ACTIVE") return { ok: false, code: "INVALID_STATE" };

  const now = new Date();
  ticket.status = "CONSUMED";
  ticket.consumedAt = now;
  ticket.consumedBy = operatorId;

  return { ok: true, consumedAt: now, tier };
}

const FUTURE = new Date(Date.now() + 86400_000 * 30);
const PAST = new Date(Date.now() - 86400_000);
const TIER: FakePriceTier = { id: "tier_1", name: "Drink", price: { toString: () => "10.00" } };

function makeTicket(overrides: Partial<FakeTicket> = {}): FakeTicket {
  return {
    id: "ticket_1",
    status: "ACTIVE",
    venueId: "venue_A",
    expiresAt: FUTURE,
    priceTierId: "tier_1",
    consumedAt: null,
    consumedBy: null,
    ...overrides,
  };
}

describe("consume transaction logic", () => {
  it("TICKET_NOT_FOUND se ticket è null", async () => {
    const r = await simulateConsume(null, "venue_A", "op_1", TIER);
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("TICKET_NOT_FOUND");
  });

  it("WRONG_VENUE se venueId non corrisponde", async () => {
    const r = await simulateConsume(makeTicket(), "venue_B", "op_1", TIER);
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("WRONG_VENUE");
  });

  it("EXPIRED se expiresAt nel passato", async () => {
    const r = await simulateConsume(makeTicket({ expiresAt: PAST }), "venue_A", "op_1", TIER);
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("EXPIRED");
  });

  it("ALREADY_CONSUMED con info operatore", async () => {
    const consumedAt = new Date();
    const ticket = makeTicket({ status: "CONSUMED", consumedAt, consumedBy: "op_2" });
    const operator: FakeOperator = { id: "op_2", name: "Barista Demo" };
    const r = await simulateConsume(ticket, "venue_A", "op_1", TIER, operator);
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("ALREADY_CONSUMED");
    expect((r as { consumedByName: string }).consumedByName).toBe("Barista Demo");
  });

  it("REFUNDED se ticket è rimborsato", async () => {
    const r = await simulateConsume(makeTicket({ status: "REFUNDED" }), "venue_A", "op_1", TIER);
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("REFUNDED");
  });

  it("consume con successo: status → CONSUMED, consumedBy popolato", async () => {
    const ticket = makeTicket();
    const r = await simulateConsume(ticket, "venue_A", "op_1", TIER);
    expect(r.ok).toBe(true);
    expect(ticket.status).toBe("CONSUMED");
    expect(ticket.consumedBy).toBe("op_1");
    expect(ticket.consumedAt).toBeInstanceOf(Date);
    expect((r as { tier: FakePriceTier }).tier.name).toBe("Drink");
  });

  it("race: secondo consume sullo stesso ticket → ALREADY_CONSUMED", async () => {
    const ticket = makeTicket();
    await simulateConsume(ticket, "venue_A", "op_1", TIER);
    const r2 = await simulateConsume(ticket, "venue_A", "op_2", TIER);
    expect(r2.ok).toBe(false);
    expect((r2 as { code: string }).code).toBe("ALREADY_CONSUMED");
  });
});
