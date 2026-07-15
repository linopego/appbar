import { describe, it, expect } from "vitest";
import { pickRecentVenues, RECENT_VENUES_MAX } from "@/lib/venues/recent";

// Sezione "I tuoi locali" in /home: distinct per locale, ordinati dal più
// recente, massimo 4, a partire dagli ordini PAID del cliente.

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
