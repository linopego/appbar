import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

// Simulates the price tier logic and immutability guarantees.

interface OrderItem {
  id: string;
  priceTierId: string;
  tierName: string; // snapshot at purchase time
  unitPrice: Decimal; // snapshot at purchase time
  quantity: number;
}

interface PriceTier {
  id: string;
  venueId: string;
  name: string;
  price: Decimal;
  active: boolean;
}

// Simulate updating a price tier
function updatePriceTier(tier: PriceTier, updates: { price?: Decimal; name?: string }): PriceTier {
  return { ...tier, ...updates };
}

// Simulates existing OrderItems — they are NOT affected by tier updates
function getOrderItemTotal(item: OrderItem): Decimal {
  return item.unitPrice.times(item.quantity);
}

describe("price tier deactivation", () => {
  const tier: PriceTier = { id: "t1", venueId: "v1", name: "Acqua", price: new Decimal("3.00"), active: true };

  it("deactivating a tier sets active=false", () => {
    const deactivated = { ...tier, active: false };
    expect(deactivated.active).toBe(false);
  });

  it("deactivating does not change price or name", () => {
    const deactivated = { ...tier, active: false };
    expect(deactivated.price.toFixed(2)).toBe("3.00");
    expect(deactivated.name).toBe("Acqua");
  });
});

describe("OrderItem snapshot immutability", () => {
  const originalTierName = "Birra";
  const originalPrice = new Decimal("6.00");

  const orderItem: OrderItem = {
    id: "oi1",
    priceTierId: "t2",
    tierName: originalTierName, // snapshot
    unitPrice: originalPrice,   // snapshot
    quantity: 2,
  };

  it("OrderItem tierName is preserved after tier rename", () => {
    // Simulate renaming the tier
    const tier: PriceTier = { id: "t2", venueId: "v1", name: "Birra Artigianale", price: new Decimal("7.00"), active: true };
    const updatedTier = updatePriceTier(tier, { name: "Birra Artigianale" });

    // The tier is updated, but the OrderItem still has the original name
    expect(updatedTier.name).toBe("Birra Artigianale");
    expect(orderItem.tierName).toBe("Birra"); // unchanged snapshot
  });

  it("OrderItem unitPrice is preserved after tier price change", () => {
    const updatedTier = updatePriceTier(
      { id: "t2", venueId: "v1", name: "Birra", price: new Decimal("6.00"), active: true },
      { price: new Decimal("7.50") }
    );

    expect(updatedTier.price.toFixed(2)).toBe("7.50");
    expect(orderItem.unitPrice.toFixed(2)).toBe("6.00"); // snapshot unchanged
  });

  it("OrderItem total uses snapshot unit price (not current tier price)", () => {
    // Even if tier price is now 7.50, the order was placed at 6.00
    const total = getOrderItemTotal(orderItem);
    expect(total.toFixed(2)).toBe("12.00"); // 6.00 × 2
  });
});

describe("price tier validation", () => {
  function isValidPrice(price: string): boolean {
    const n = parseFloat(price);
    return !isNaN(n) && n >= 0.01 && n <= 999.99;
  }

  it("accepts 3.00", () => expect(isValidPrice("3.00")).toBe(true));
  it("accepts 0.01 (minimum)", () => expect(isValidPrice("0.01")).toBe(true));
  it("accepts 999.99 (maximum)", () => expect(isValidPrice("999.99")).toBe(true));
  it("rejects 0.00", () => expect(isValidPrice("0.00")).toBe(false));
  it("rejects negative", () => expect(isValidPrice("-1.00")).toBe(false));
  it("rejects 1000.00 (above max)", () => expect(isValidPrice("1000.00")).toBe(false));
  it("rejects non-numeric", () => expect(isValidPrice("abc")).toBe(false));
});
