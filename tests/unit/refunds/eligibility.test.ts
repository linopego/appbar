import { describe, expect, it } from "vitest";
import { computeTicketStatus } from "@/lib/tickets/status";

const FUTURE = new Date(Date.now() + 86400_000 * 30);
const PAST = new Date(Date.now() - 86400_000);

type FakeTicket = Parameters<typeof computeTicketStatus>[0];

function makeTicket(overrides: Partial<FakeTicket> = {}): FakeTicket {
  return { status: "ACTIVE", expiresAt: FUTURE, ...overrides };
}

// Simulate the eligibility logic from the refund-request route
function computeEligibility(
  tickets: FakeTicket[],
  pendingRefundTicketIds: string[] = []
): {
  refundable: number;
  nonRefundable: Array<{ reason: string }>;
} {
  const pendingSet = new Set(pendingRefundTicketIds);
  const refundable: typeof tickets = [];
  const nonRefundable: Array<{ reason: string }> = [];

  for (const ticket of tickets) {
    const id = (ticket as { id?: string }).id ?? "";
    if (pendingSet.has(id)) {
      nonRefundable.push({ reason: "IN_PENDING_REFUND" });
      continue;
    }
    const status = computeTicketStatus(ticket);
    if (status === "ACTIVE") {
      refundable.push(ticket);
    } else {
      nonRefundable.push({ reason: status });
    }
  }

  return { refundable: refundable.length, nonRefundable };
}

describe("refund eligibility logic", () => {
  it("all ACTIVE tickets are refundable", () => {
    const tickets = [makeTicket(), makeTicket(), makeTicket()];
    const { refundable, nonRefundable } = computeEligibility(tickets);
    expect(refundable).toBe(3);
    expect(nonRefundable).toHaveLength(0);
  });

  it("mix of ACTIVE and CONSUMED: only ACTIVE are refundable", () => {
    const tickets = [
      makeTicket({ status: "ACTIVE" }),
      makeTicket({ status: "CONSUMED" }),
      makeTicket({ status: "ACTIVE" }),
    ];
    const { refundable, nonRefundable } = computeEligibility(tickets);
    expect(refundable).toBe(2);
    expect(nonRefundable).toHaveLength(1);
    expect(nonRefundable[0].reason).toBe("CONSUMED");
  });

  it("all CONSUMED → 0 refundable", () => {
    const tickets = [
      makeTicket({ status: "CONSUMED" }),
      makeTicket({ status: "CONSUMED" }),
    ];
    const { refundable } = computeEligibility(tickets);
    expect(refundable).toBe(0);
  });

  it("expired ticket (past expiresAt) → not refundable", () => {
    const tickets = [
      makeTicket({ status: "ACTIVE", expiresAt: PAST }),
    ];
    const { refundable, nonRefundable } = computeEligibility(tickets);
    expect(refundable).toBe(0);
    expect(nonRefundable[0].reason).toBe("EXPIRED");
  });

  it("already REFUNDED ticket → not refundable", () => {
    const tickets = [makeTicket({ status: "REFUNDED" })];
    const { refundable, nonRefundable } = computeEligibility(tickets);
    expect(refundable).toBe(0);
    expect(nonRefundable[0].reason).toBe("REFUNDED");
  });

  it("ticket already in pending refund → IN_PENDING_REFUND reason", () => {
    const tickets = [{ id: "t1", status: "ACTIVE" as const, expiresAt: FUTURE }];
    const { refundable, nonRefundable } = computeEligibility(tickets, ["t1"]);
    expect(refundable).toBe(0);
    expect(nonRefundable[0].reason).toBe("IN_PENDING_REFUND");
  });

  it("one ticket in pending refund, one ACTIVE → 1 refundable", () => {
    const tickets = [
      { id: "t1", status: "ACTIVE" as const, expiresAt: FUTURE },
      { id: "t2", status: "ACTIVE" as const, expiresAt: FUTURE },
    ];
    const { refundable } = computeEligibility(tickets, ["t1"]);
    expect(refundable).toBe(1);
  });
});
