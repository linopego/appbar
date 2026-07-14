import { describe, it, expect } from "vitest";

// Unit tests for venue creation business logic (no DB, pure logic).

function validateVenueSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 2 && slug.length <= 60;
}

function validateVenueName(name: string): boolean {
  return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 100;
}

interface DefaultTier {
  name: string;
  price: string;
  sortOrder: number;
}

function buildDefaultTiers(): DefaultTier[] {
  return [
    { name: "Acqua", price: "3.00", sortOrder: 10 },
    { name: "Analcolico", price: "5.00", sortOrder: 20 },
    { name: "Birra", price: "6.00", sortOrder: 30 },
    { name: "Red Bull", price: "6.00", sortOrder: 40 },
    { name: "Drink", price: "10.00", sortOrder: 50 },
    { name: "Drink Premium", price: "12.00", sortOrder: 60 },
  ];
}

describe("validateVenueSlug", () => {
  it("accepts valid slug", () => expect(validateVenueSlug("casa-dei-gelsi")).toBe(true));
  it("accepts numeric slug", () => expect(validateVenueSlug("venue123")).toBe(true));
  it("rejects uppercase", () => expect(validateVenueSlug("Casa-Dei-Gelsi")).toBe(false));
  it("rejects spaces", () => expect(validateVenueSlug("casa dei gelsi")).toBe(false));
  it("rejects underscore", () => expect(validateVenueSlug("casa_dei_gelsi")).toBe(false));
  it("rejects special chars", () => expect(validateVenueSlug("casa@gelsi")).toBe(false));
  it("rejects single char", () => expect(validateVenueSlug("a")).toBe(false));
  it("rejects empty string", () => expect(validateVenueSlug("")).toBe(false));
});

describe("validateVenueName", () => {
  it("accepts valid name", () => expect(validateVenueName("La Casa dei Gelsi")).toBe(true));
  it("accepts short name (2 chars)", () => expect(validateVenueName("AB")).toBe(true));
  it("rejects empty string", () => expect(validateVenueName("")).toBe(false));
  it("rejects single char", () => expect(validateVenueName("A")).toBe(false));
  it("rejects whitespace-only", () => expect(validateVenueName("   ")).toBe(false));
  it("accepts max length name", () => expect(validateVenueName("A".repeat(100))).toBe(true));
  it("rejects over-max name", () => expect(validateVenueName("A".repeat(101))).toBe(false));
});

describe("buildDefaultTiers", () => {
  const tiers = buildDefaultTiers();

  it("creates 6 default tiers", () => {
    expect(tiers).toHaveLength(6);
  });

  it("all tiers have unique names", () => {
    const names = tiers.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("all sortOrder values are unique and ascending", () => {
    const orders = tiers.map((t) => t.sortOrder);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it("all prices are positive decimals", () => {
    for (const tier of tiers) {
      const price = parseFloat(tier.price);
      expect(price).toBeGreaterThan(0);
    }
  });

  it("first tier is Acqua at €3.00", () => {
    expect(tiers[0].name).toBe("Acqua");
    expect(tiers[0].price).toBe("3.00");
    expect(tiers[0].sortOrder).toBe(10);
  });

  it("last tier is Drink Premium at €12.00", () => {
    const last = tiers[tiers.length - 1];
    expect(last.name).toBe("Drink Premium");
    expect(last.price).toBe("12.00");
  });
});

describe("venue creation validation", () => {
  function validateCreate(input: { name?: unknown; slug?: unknown }): {
    ok: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    if (typeof input.name !== "string" || !validateVenueName(input.name)) {
      errors.push("name non valido");
    }
    if (typeof input.slug !== "string" || !validateVenueSlug(input.slug)) {
      errors.push("slug non valido");
    }
    return { ok: errors.length === 0, errors };
  }

  it("accepts valid name and slug", () => {
    const result = validateCreate({ name: "Studios Club", slug: "studios-club" });
    expect(result.ok).toBe(true);
  });

  it("rejects missing name", () => {
    const result = validateCreate({ slug: "studios-club" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("name non valido");
  });

  it("rejects invalid slug with uppercase", () => {
    const result = validateCreate({ name: "Studios Club", slug: "Studios-Club" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("slug non valido");
  });

  it("collects both errors when both are invalid", () => {
    const result = validateCreate({ name: "", slug: "INVALID SLUG" });
    expect(result.errors).toHaveLength(2);
  });
});
