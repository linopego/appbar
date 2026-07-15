import { describe, it, expect } from "vitest";
import {
  lastPurchaseLabel,
  pickRecentVenues,
  RECENT_VENUE_ORDER_STATUSES,
  RECENT_VENUES_MAX,
} from "@/lib/venues/recent";

// Sezione "I tuoi locali" in /home: distinct per locale, ordinati dall'ultimo
// acquisto più recente, massimo 4, a partire dagli ordini pagati del cliente.

const order = (slug: string, daysAgo: number) => ({
  createdAt: new Date(Date.now() - daysAgo * 86400000),
  venue: { name: slug.toUpperCase(), slug },
});

describe("pickRecentVenues", () => {
  it("dedup: lo stesso locale compare una sola volta", () => {
    const result = pickRecentVenues([
      order("bar-a", 1),
      order("bar-a", 2),
      order("bar-b", 3),
      order("bar-a", 4),
    ]);
    expect(result.map((v) => v.slug)).toEqual(["bar-a", "bar-b"]);
  });

  it("ordinamento: dal locale con l'ordine più recente", () => {
    const result = pickRecentVenues([
      order("piu-recente", 0),
      order("mezzo", 5),
      order("vecchio", 30),
    ]);
    expect(result.map((v) => v.slug)).toEqual(["piu-recente", "mezzo", "vecchio"]);
  });

  it("lastOrderAt: la data dell'ultimo acquisto per quel locale", () => {
    const recent = order("bar-a", 1);
    const result = pickRecentVenues([recent, order("bar-a", 10)]);
    expect(result[0]?.lastOrderAt).toEqual(recent.createdAt);
  });

  it("massimo 4 locali", () => {
    const orders = ["a", "b", "c", "d", "e", "f"].map((s, i) => order(s, i));
    const result = pickRecentVenues(orders);
    expect(result).toHaveLength(RECENT_VENUES_MAX);
    expect(result.map((v) => v.slug)).toEqual(["a", "b", "c", "d"]);
  });

  it("nessun ordine → nessun locale", () => {
    expect(pickRecentVenues([])).toEqual([]);
  });
});

describe("RECENT_VENUE_ORDER_STATUSES", () => {
  it("un rimborso parziale non fa sparire il locale", () => {
    expect(RECENT_VENUE_ORDER_STATUSES).toContain("PAID");
    expect(RECENT_VENUE_ORDER_STATUSES).toContain("PARTIALLY_REFUNDED");
    // i non pagati o interamente rimborsati non contano
    expect(RECENT_VENUE_ORDER_STATUSES).not.toContain("PENDING");
    expect(RECENT_VENUE_ORDER_STATUSES).not.toContain("REFUNDED");
    expect(RECENT_VENUE_ORDER_STATUSES).not.toContain("FAILED");
  });
});

describe("lastPurchaseLabel", () => {
  it('formato "GG mese" in italiano', () => {
    expect(lastPurchaseLabel(new Date(2026, 6, 15))).toBe("15 luglio");
    expect(lastPurchaseLabel(new Date(2026, 0, 3))).toBe("3 gennaio");
  });
});
