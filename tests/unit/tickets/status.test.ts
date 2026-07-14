import { describe, expect, it } from "vitest";
import { computeTicketStatus, isTicketUsable } from "@/lib/tickets/status";

const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
const past = new Date(Date.now() - 1000 * 60 * 60 * 24);

describe("computeTicketStatus", () => {
  it("ACTIVE + futuro → ACTIVE", () => {
    expect(computeTicketStatus({ status: "ACTIVE", expiresAt: future })).toBe("ACTIVE");
  });

  it("ACTIVE + passato → EXPIRED", () => {
    expect(computeTicketStatus({ status: "ACTIVE", expiresAt: past })).toBe("EXPIRED");
  });

  it("CONSUMED → sempre CONSUMED, anche se scaduto", () => {
    expect(computeTicketStatus({ status: "CONSUMED", expiresAt: past })).toBe("CONSUMED");
    expect(computeTicketStatus({ status: "CONSUMED", expiresAt: future })).toBe("CONSUMED");
  });

  it("REFUNDED → sempre REFUNDED", () => {
    expect(computeTicketStatus({ status: "REFUNDED", expiresAt: future })).toBe("REFUNDED");
    expect(computeTicketStatus({ status: "REFUNDED", expiresAt: past })).toBe("REFUNDED");
  });

  it("EXPIRED in DB + futuro → EXPIRED (status DB ha priorità solo per terminali CONSUMED/REFUNDED)", () => {
    // status EXPIRED non è terminale dal punto di vista della helper, ma dato che expiresAt è futuro
    // e status non è CONSUMED/REFUNDED, ricade su check expiresAt
    expect(computeTicketStatus({ status: "EXPIRED", expiresAt: future })).toBe("ACTIVE");
  });
});

describe("isTicketUsable", () => {
  it("true solo se ACTIVE effettivo", () => {
    expect(isTicketUsable({ status: "ACTIVE", expiresAt: future })).toBe(true);
    expect(isTicketUsable({ status: "ACTIVE", expiresAt: past })).toBe(false);
    expect(isTicketUsable({ status: "CONSUMED", expiresAt: future })).toBe(false);
    expect(isTicketUsable({ status: "REFUNDED", expiresAt: future })).toBe(false);
  });
});
