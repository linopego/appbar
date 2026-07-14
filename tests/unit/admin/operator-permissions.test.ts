import { describe, it, expect } from "vitest";

// Simulates the venue-scoping and self-protection logic from the API routes.

interface Operator {
  id: string;
  venueId: string;
  role: "BARISTA" | "CASSIERE" | "MANAGER";
  active: boolean;
  name: string;
}

interface Session {
  operatorId: string;
  venueId: string;
  role: "MANAGER";
}

function canEditOperator(session: Session, target: Operator): { allowed: boolean; reason?: string } {
  if (target.venueId !== session.venueId) return { allowed: false, reason: "VENUE_MISMATCH" };
  if (target.id === session.operatorId) return { allowed: false, reason: "SELF_EDIT" };
  return { allowed: true };
}

function canDeactivateOperator(session: Session, target: Operator): { allowed: boolean; reason?: string } {
  if (target.venueId !== session.venueId) return { allowed: false, reason: "VENUE_MISMATCH" };
  if (target.id === session.operatorId) return { allowed: false, reason: "SELF_DEACTIVATION" };
  return { allowed: true };
}

function canCreateRole(role: "BARISTA" | "CASSIERE" | "MANAGER"): boolean {
  // Manager can create any role
  return ["BARISTA", "CASSIERE", "MANAGER"].includes(role);
}

const sessionA: Session = { operatorId: "manager-a1", venueId: "venue-a", role: "MANAGER" };
const sessionB: Session = { operatorId: "manager-b1", venueId: "venue-b", role: "MANAGER" };

const baristaA: Operator = { id: "barista-a1", venueId: "venue-a", role: "BARISTA", active: true, name: "Marco" };
const baristaB: Operator = { id: "barista-b1", venueId: "venue-b", role: "BARISTA", active: true, name: "Luca" };
const managerA: Operator = { id: "manager-a1", venueId: "venue-a", role: "MANAGER", active: true, name: "Anna" };

describe("operator venue-scoping", () => {
  it("manager venueA can edit barista of venueA", () => {
    const result = canEditOperator(sessionA, baristaA);
    expect(result.allowed).toBe(true);
  });

  it("manager venueA cannot edit barista of venueB", () => {
    const result = canEditOperator(sessionA, baristaB);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("VENUE_MISMATCH");
  });

  it("manager venueB cannot edit operator of venueA", () => {
    const result = canEditOperator(sessionB, baristaA);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("VENUE_MISMATCH");
  });
});

describe("self-protection", () => {
  it("manager cannot edit themselves", () => {
    const result = canEditOperator(sessionA, managerA);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("SELF_EDIT");
  });

  it("manager cannot deactivate themselves", () => {
    const result = canDeactivateOperator(sessionA, managerA);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("SELF_DEACTIVATION");
  });

  it("manager can deactivate another operator in same venue", () => {
    const result = canDeactivateOperator(sessionA, baristaA);
    expect(result.allowed).toBe(true);
  });
});

describe("role creation permissions", () => {
  it("manager can create BARISTA", () => {
    expect(canCreateRole("BARISTA")).toBe(true);
  });

  it("manager can create CASSIERE", () => {
    expect(canCreateRole("CASSIERE")).toBe(true);
  });

  it("manager can create MANAGER (audit-logged)", () => {
    expect(canCreateRole("MANAGER")).toBe(true);
  });
});

describe("PIN validation", () => {
  function isValidPin(pin: string): boolean {
    return /^\d{4,6}$/.test(pin);
  }

  it("accepts 4-digit PIN", () => expect(isValidPin("1234")).toBe(true));
  it("accepts 6-digit PIN", () => expect(isValidPin("123456")).toBe(true));
  it("rejects 3-digit PIN", () => expect(isValidPin("123")).toBe(false));
  it("rejects 7-digit PIN", () => expect(isValidPin("1234567")).toBe(false));
  it("rejects non-numeric PIN", () => expect(isValidPin("abc1")).toBe(false));
  it("accepts 5-digit PIN", () => expect(isValidPin("12345")).toBe(true));
});
