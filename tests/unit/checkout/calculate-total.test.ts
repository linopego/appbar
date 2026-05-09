import { describe, expect, it } from "vitest";
import { calculateOrderTotal } from "@/lib/checkout/total";
import { Prisma } from "@prisma/client";

describe("calculateOrderTotal", () => {
  it("restituisce zero per lista vuota", () => {
    const result = calculateOrderTotal([]);
    expect(result.equals(new Prisma.Decimal(0))).toBe(true);
  });

  it("calcola correttamente un singolo articolo", () => {
    const result = calculateOrderTotal([{ pricePerUnit: "5.00", quantity: 3 }]);
    expect(result.equals(new Prisma.Decimal("15.00"))).toBe(true);
  });

  it("somma più articoli", () => {
    const result = calculateOrderTotal([
      { pricePerUnit: "3.00", quantity: 2 },
      { pricePerUnit: "5.50", quantity: 4 },
    ]);
    expect(result.equals(new Prisma.Decimal("28.00"))).toBe(true);
  });

  it("gestisce valori Decimal di Prisma", () => {
    const result = calculateOrderTotal([
      { pricePerUnit: new Prisma.Decimal("7.50"), quantity: 2 },
    ]);
    expect(result.equals(new Prisma.Decimal("15.00"))).toBe(true);
  });

  it("gestisce quantità 1", () => {
    const result = calculateOrderTotal([{ pricePerUnit: "12.99", quantity: 1 }]);
    expect(result.equals(new Prisma.Decimal("12.99"))).toBe(true);
  });

  it("gestisce prezzi decimali con precisione", () => {
    const result = calculateOrderTotal([
      { pricePerUnit: "0.10", quantity: 3 },
    ]);
    expect(result.equals(new Prisma.Decimal("0.30"))).toBe(true);
  });
});
