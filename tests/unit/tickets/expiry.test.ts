import { describe, it, expect } from "vitest";
import { daysUntil, expiryLabel, isExpiringSoon } from "@/lib/tickets/expiry";

const NOW = new Date("2026-07-14T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86400000);

describe("scadenza ticket (evidenza in /home)", () => {
  it("entro 7 giorni → in scadenza", () => {
    expect(isExpiringSoon(days(1), NOW)).toBe(true);
    expect(isExpiringSoon(days(7), NOW)).toBe(true);
  });

  it("oltre 7 giorni o già scaduto → non evidenziato", () => {
    expect(isExpiringSoon(days(8), NOW)).toBe(false);
    expect(isExpiringSoon(days(-1), NOW)).toBe(false);
  });

  it("etichette in italiano corrette", () => {
    expect(expiryLabel(days(1), NOW)).toBe("Scade tra 1 giorno");
    expect(expiryLabel(days(5), NOW)).toBe("Scade tra 5 giorni");
    expect(expiryLabel(days(-1), NOW)).toBe("Scaduto");
  });

  it("arrotondamento per eccesso: mezzo giorno → 1 giorno", () => {
    expect(daysUntil(new Date(NOW.getTime() + 12 * 3600000), NOW)).toBe(1);
  });
});
