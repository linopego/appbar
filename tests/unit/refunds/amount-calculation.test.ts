import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

function sumTicketPrices(prices: string[]): string {
  const total = prices.reduce((sum, p) => sum + Number(p), 0);
  // Use toFixed to avoid float drift, then verify precision
  return total.toFixed(2);
}

// Simulate using Prisma Decimal arithmetic for precision
function sumDecimalPrices(prices: string[]): string {
  let total = new Decimal(0);
  for (const p of prices) {
    total = total.plus(new Decimal(p));
  }
  return total.toFixed(2);
}

describe("refund amount calculation", () => {
  it("2 Drink + 1 Birra = 26.00", () => {
    const prices = ["10.00", "10.00", "6.00"];
    expect(sumTicketPrices(prices)).toBe("26.00");
    expect(sumDecimalPrices(prices)).toBe("26.00");
  });

  it("single Acqua = 3.00", () => {
    expect(sumTicketPrices(["3.00"])).toBe("3.00");
  });

  it("all tiers summed correctly", () => {
    const prices = ["3.00", "5.00", "6.00", "6.00", "10.00", "12.00"];
    expect(sumDecimalPrices(prices)).toBe("42.00");
  });

  it("decimal precision: no float drift with 3x 6.00", () => {
    const prices = ["6.00", "6.00", "6.00"];
    expect(sumDecimalPrices(prices)).toBe("18.00");
    // Verify JS float is accurate too for these values
    expect(sumTicketPrices(prices)).toBe("18.00");
  });

  it("Stripe amount in cents: 26.00 → 2600", () => {
    const amount = "26.00";
    const cents = Math.round(Number(amount) * 100);
    expect(cents).toBe(2600);
  });

  it("Stripe amount rounding: 10.50 → 1050 cents", () => {
    const amount = "10.50";
    const cents = Math.round(Number(amount) * 100);
    expect(cents).toBe(1050);
  });
});
