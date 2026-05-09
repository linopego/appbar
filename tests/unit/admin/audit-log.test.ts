import { describe, it, expect, vi, beforeEach } from "vitest";

// Unit tests for audit log helper — verify the right actorType is set without hitting the DB.

const mockCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
vi.mock("@/lib/db", () => ({
  db: {
    adminAuditLog: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

import { logAdminAction, logManagerAction } from "@/lib/audit";

beforeEach(() => {
  mockCreate.mockClear();
});

describe("logAdminAction", () => {
  it("creates audit log with actorType=ADMIN_USER", async () => {
    await logAdminAction({
      adminUserId: "admin-1",
      action: "REFUND_APPROVED",
      targetType: "Refund",
      targetId: "ref-1",
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.actorType).toBe("ADMIN_USER");
    expect(call.data.adminUserId).toBe("admin-1");
    expect(call.data.operatorId).toBeUndefined();
    expect(call.data.action).toBe("REFUND_APPROVED");
  });

  it("includes optional payload", async () => {
    await logAdminAction({
      adminUserId: "admin-1",
      action: "TICKET_INVALIDATED",
      payload: { ticketIds: ["t1", "t2"], reason: "frode" },
    });

    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.payload).toEqual({ ticketIds: ["t1", "t2"], reason: "frode" });
  });

  it("omits undefined optional fields", async () => {
    await logAdminAction({ adminUserId: "admin-1", action: "TEST_ACTION" });

    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect("targetType" in call.data).toBe(false);
    expect("targetId" in call.data).toBe(false);
    expect("payload" in call.data).toBe(false);
  });
});

describe("logManagerAction", () => {
  it("creates audit log with actorType=OPERATOR", async () => {
    await logManagerAction({
      operatorId: "op-1",
      action: "OPERATOR_CREATED",
      targetType: "Operator",
      targetId: "op-2",
      payload: { name: "Marco", role: "BARISTA" },
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.actorType).toBe("OPERATOR");
    expect(call.data.operatorId).toBe("op-1");
    expect(call.data.adminUserId).toBeUndefined();
    expect(call.data.action).toBe("OPERATOR_CREATED");
  });

  it("logs PRICE_TIER_DEACTIVATED correctly", async () => {
    await logManagerAction({
      operatorId: "op-1",
      action: "PRICE_TIER_DEACTIVATED",
      targetType: "PriceTier",
      targetId: "tier-99",
    });

    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.targetType).toBe("PriceTier");
    expect(call.data.targetId).toBe("tier-99");
    expect(call.data.actorType).toBe("OPERATOR");
  });

  it("logs VENUE_SETTINGS_UPDATED with payload", async () => {
    const windows = [{ day: 5, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }];

    await logManagerAction({
      operatorId: "op-1",
      action: "VENUE_SETTINGS_UPDATED",
      targetType: "Venue",
      targetId: "venue-1",
      payload: { windows, timezone: "Europe/Rome" },
    });

    const call = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect((call.data.payload as { timezone: string }).timezone).toBe("Europe/Rome");
  });
});
