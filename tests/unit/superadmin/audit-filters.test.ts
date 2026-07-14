import { describe, it, expect } from "vitest";

// Unit tests for audit log filter logic (no DB, pure logic).

type ActorType = "ADMIN_USER" | "OPERATOR" | "SYSTEM";

interface AuditEntry {
  id: string;
  actorType: ActorType;
  adminUserId?: string | null;
  operatorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  createdAt: Date;
}

interface AuditFilters {
  actorType?: ActorType | "all";
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
}

function applyAuditFilters(entries: AuditEntry[], filters: AuditFilters): AuditEntry[] {
  return entries.filter((e) => {
    if (filters.actorType && filters.actorType !== "all" && e.actorType !== filters.actorType) return false;

    if (filters.actorId) {
      const matchesAdmin = e.adminUserId === filters.actorId;
      const matchesOperator = e.operatorId === filters.actorId;
      if (!matchesAdmin && !matchesOperator) return false;
    }

    if (filters.action) {
      if (!e.action.toLowerCase().includes(filters.action.toLowerCase())) return false;
    }

    if (filters.targetType && e.targetType !== filters.targetType) return false;
    if (filters.targetId && e.targetId !== filters.targetId) return false;

    if (filters.from && e.createdAt < filters.from) return false;
    if (filters.to) {
      const toEnd = new Date(filters.to);
      toEnd.setHours(23, 59, 59, 999);
      if (e.createdAt > toEnd) return false;
    }

    return true;
  });
}

const ENTRIES: AuditEntry[] = [
  {
    id: "1",
    actorType: "ADMIN_USER",
    adminUserId: "admin-1",
    action: "VENUE_CREATED",
    targetType: "Venue",
    targetId: "venue-1",
    createdAt: new Date("2026-05-01T10:00:00Z"),
  },
  {
    id: "2",
    actorType: "OPERATOR",
    operatorId: "op-1",
    action: "PRICE_TIER_DEACTIVATED",
    targetType: "PriceTier",
    targetId: "tier-1",
    createdAt: new Date("2026-05-02T12:00:00Z"),
  },
  {
    id: "3",
    actorType: "ADMIN_USER",
    adminUserId: "admin-2",
    action: "REFUND_APPROVED",
    targetType: "Refund",
    targetId: "ref-1",
    createdAt: new Date("2026-05-03T14:00:00Z"),
  },
  {
    id: "4",
    actorType: "SYSTEM",
    action: "TICKET_EXPIRED",
    targetType: "Ticket",
    targetId: "ticket-1",
    createdAt: new Date("2026-05-04T09:00:00Z"),
  },
  {
    id: "5",
    actorType: "OPERATOR",
    operatorId: "op-2",
    action: "OPERATOR_CREATED",
    targetType: "Operator",
    targetId: "op-3",
    createdAt: new Date("2026-05-05T16:00:00Z"),
  },
];

describe("filter by actorType", () => {
  it("returns only ADMIN_USER entries", () => {
    const result = applyAuditFilters(ENTRIES, { actorType: "ADMIN_USER" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.actorType === "ADMIN_USER")).toBe(true);
  });

  it("returns only OPERATOR entries", () => {
    const result = applyAuditFilters(ENTRIES, { actorType: "OPERATOR" });
    expect(result).toHaveLength(2);
  });

  it("returns only SYSTEM entries", () => {
    const result = applyAuditFilters(ENTRIES, { actorType: "SYSTEM" });
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("TICKET_EXPIRED");
  });

  it("returns all entries when actorType=all", () => {
    const result = applyAuditFilters(ENTRIES, { actorType: "all" });
    expect(result).toHaveLength(5);
  });

  it("returns all entries when no actorType filter", () => {
    const result = applyAuditFilters(ENTRIES, {});
    expect(result).toHaveLength(5);
  });
});

describe("filter by actorId", () => {
  it("matches adminUserId", () => {
    const result = applyAuditFilters(ENTRIES, { actorId: "admin-1" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches operatorId", () => {
    const result = applyAuditFilters(ENTRIES, { actorId: "op-1" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("returns empty for unknown actorId", () => {
    const result = applyAuditFilters(ENTRIES, { actorId: "nonexistent" });
    expect(result).toHaveLength(0);
  });
});

describe("filter by action (case-insensitive substring)", () => {
  it("matches exact action", () => {
    const result = applyAuditFilters(ENTRIES, { action: "VENUE_CREATED" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches partial action (case-insensitive)", () => {
    const result = applyAuditFilters(ENTRIES, { action: "refund" });
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("REFUND_APPROVED");
  });

  it("matches multiple entries with shared substring", () => {
    const result = applyAuditFilters(ENTRIES, { action: "operator" });
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("OPERATOR_CREATED");
  });
});

describe("filter by targetType", () => {
  it("matches Venue", () => {
    const result = applyAuditFilters(ENTRIES, { targetType: "Venue" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches PriceTier", () => {
    const result = applyAuditFilters(ENTRIES, { targetType: "PriceTier" });
    expect(result).toHaveLength(1);
  });
});

describe("filter by date range", () => {
  it("filters from date", () => {
    const result = applyAuditFilters(ENTRIES, { from: new Date("2026-05-03T00:00:00Z") });
    expect(result).toHaveLength(3);
    expect(result.every((e) => e.createdAt >= new Date("2026-05-03T00:00:00Z"))).toBe(true);
  });

  it("filters to date (inclusive, end of day)", () => {
    const result = applyAuditFilters(ENTRIES, { to: new Date("2026-05-02T00:00:00Z") });
    expect(result).toHaveLength(2);
  });

  it("filters by range (from + to)", () => {
    const result = applyAuditFilters(ENTRIES, {
      from: new Date("2026-05-02T00:00:00Z"),
      to: new Date("2026-05-03T00:00:00Z"),
    });
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id).sort()).toEqual(["2", "3"]);
  });

  it("returns empty for future range", () => {
    const result = applyAuditFilters(ENTRIES, { from: new Date("2027-01-01T00:00:00Z") });
    expect(result).toHaveLength(0);
  });
});

describe("combined filters", () => {
  it("actorType + targetType narrows results", () => {
    const result = applyAuditFilters(ENTRIES, { actorType: "ADMIN_USER", targetType: "Venue" });
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("VENUE_CREATED");
  });

  it("actorType + action + date filters correctly", () => {
    const result = applyAuditFilters(ENTRIES, {
      actorType: "OPERATOR",
      action: "PRICE",
      from: new Date("2026-05-02T00:00:00Z"),
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("overlapping filters return empty when no match", () => {
    const result = applyAuditFilters(ENTRIES, {
      actorType: "SYSTEM",
      targetType: "Venue",
    });
    expect(result).toHaveLength(0);
  });
});
