import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Corrispettivi: la "giornata" è quella solare Europe/Rome (le serate
// scavallano mezzanotte), il venduto è lordo per data di pagamento e i
// rimborsi restano SEPARATI, mai sottratti.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
    refund: { findMany: vi.fn().mockResolvedValue([]) },
    ticket: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  aggregateByTier,
  aggregateRefunds,
  buildCorrispettiviCsv,
  dayKeyInTimezone,
  dayRangeInTimezone,
  getCorrispettivi,
  hasMovements,
  parseReportDays,
  rangeInTimezone,
  yesterdayInTimezone,
} from "@/lib/reports/corrispettivi";

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.orderItem.findMany.mockResolvedValue([]);
  dbMock.refund.findMany.mockResolvedValue([]);
  dbMock.ticket.findMany.mockResolvedValue([]);
});

describe("giornata solare Europe/Rome", () => {
  it("estate (CEST, UTC+2): il 15 luglio va da 22:00Z del 14 a 22:00Z del 15", () => {
    const { start, end } = dayRangeInTimezone("2026-07-15");
    expect(start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });

  it("inverno (CET, UTC+1): il 15 gennaio va da 23:00Z del 14 a 23:00Z del 15", () => {
    const { start, end } = dayRangeInTimezone("2026-01-15");
    expect(start.toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-15T23:00:00.000Z");
  });

  it("a cavallo di mezzanotte: 23:50 è del giorno prima, 00:10 del giorno dopo", () => {
    // Ordine pagato alle 23:50 ora italiana del 15/7 (= 21:50Z)
    const at2350 = new Date("2026-07-15T21:50:00Z");
    // Ordine pagato alle 00:10 ora italiana del 16/7 (= 22:10Z del 15/7 UTC!)
    const at0010 = new Date("2026-07-15T22:10:00Z");

    expect(dayKeyInTimezone(at2350)).toBe("2026-07-15");
    expect(dayKeyInTimezone(at0010)).toBe("2026-07-16");

    const day15 = dayRangeInTimezone("2026-07-15");
    expect(at2350 >= day15.start && at2350 < day15.end).toBe(true);
    expect(at0010 >= day15.start && at0010 < day15.end).toBe(false);

    const day16 = dayRangeInTimezone("2026-07-16");
    expect(at0010 >= day16.start && at0010 < day16.end).toBe(true);
  });

  it("cambio ora legale: il giorno del passaggio dura 23 o 25 ore", () => {
    // 29 marzo 2026: entra l'ora legale → 23 ore
    const spring = dayRangeInTimezone("2026-03-29");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 3600_000);
    // 25 ottobre 2026: torna l'ora solare → 25 ore
    const autumn = dayRangeInTimezone("2026-10-25");
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * 3600_000);
  });

  it("yesterdayInTimezone ragiona in ora italiana, non UTC", () => {
    // 22:30Z del 15/7 = 00:30 del 16/7 in Italia → "ieri" è il 15, non il 14
    expect(yesterdayInTimezone(new Date("2026-07-15T22:30:00Z"))).toBe("2026-07-15");
    // 12:00Z del 15/7 → ieri è il 14
    expect(yesterdayInTimezone(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07-14");
  });

  it("parseReportDays: default ieri, intervallo mai invertito, input sporchi ignorati", () => {
    const now = new Date("2026-07-16T08:00:00Z");
    expect(parseReportDays(undefined, undefined, now)).toEqual({ da: "2026-07-15", a: "2026-07-15" });
    expect(parseReportDays("2026-07-10", "2026-07-12", now)).toEqual({ da: "2026-07-10", a: "2026-07-12" });
    expect(parseReportDays("2026-07-12", "2026-07-10", now)).toEqual({ da: "2026-07-12", a: "2026-07-12" });
    expect(parseReportDays("x", "y", now)).toEqual({ da: "2026-07-15", a: "2026-07-15" });
  });

  it("rangeInTimezone copre da inizio 'da' a fine 'a'", () => {
    const range = rangeInTimezone("2026-07-15", "2026-07-16");
    expect(range.start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-16T22:00:00.000Z");
  });
});

describe("aggregazioni per fascia", () => {
  it("raggruppa per fascia: quantità × prezzo = totale", () => {
    const agg = aggregateByTier([
      { tierName: "Birra", quantity: 2, unitPrice: "6.00" },
      { tierName: "Birra", quantity: 3, unitPrice: "6.00" },
      { tierName: "Acqua", quantity: 1, unitPrice: "3.00" },
    ]);
    expect(agg.rows).toEqual([
      { tierName: "Acqua", quantity: 1, unitPrice: "3.00", total: "3.00" },
      { tierName: "Birra", quantity: 5, unitPrice: "6.00", total: "30.00" },
    ]);
    expect(agg.totalQuantity).toBe(6);
    expect(agg.total).toBe("33.00");
  });

  it("cambio prezzo nel periodo: due righe distinte per la stessa fascia", () => {
    const agg = aggregateByTier([
      { tierName: "Drink", quantity: 2, unitPrice: "8.00" },
      { tierName: "Drink", quantity: 1, unitPrice: "9.00" },
    ]);
    expect(agg.rows).toHaveLength(2);
    expect(agg.total).toBe("25.00");
  });

  it("accetta Prisma.Decimal", () => {
    const agg = aggregateByTier([
      { tierName: "Acqua", quantity: 4, unitPrice: new Prisma.Decimal("2.50") },
    ]);
    expect(agg.total).toBe("10.00");
  });
});

describe("rimborsi separati dal venduto", () => {
  it("getCorrispettivi: il venduto resta lordo, il rimborsato è a parte", async () => {
    dbMock.orderItem.findMany.mockResolvedValue([
      { tierName: "Birra", quantity: 10, unitPrice: new Prisma.Decimal("6.00") },
    ]);
    dbMock.refund.findMany.mockResolvedValue([
      { amount: new Prisma.Decimal("12.00") },
      { amount: new Prisma.Decimal("6.00") },
    ]);

    const range = dayRangeInTimezone("2026-07-15");
    const report = await getCorrispettivi("venue-1", range);

    expect(report.sold.total).toBe("60.00"); // NON 42.00
    expect(report.refunded).toEqual({ count: 2, total: "18.00" });
    expect(hasMovements(report)).toBe(true);

    // il venduto filtra per data di PAGAMENTO e include ordini poi rimborsati
    const orderWhere = dbMock.orderItem.findMany.mock.calls[0][0].where.order;
    expect(orderWhere.paidAt).toEqual({ gte: range.start, lt: range.end });
    expect(orderWhere.status.in).toEqual(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);

    // i rimborsi contano solo se COMPLETED, per data di completamento
    const refundWhere = dbMock.refund.findMany.mock.calls[0][0].where;
    expect(refundWhere.status).toBe("COMPLETED");
    expect(refundWhere.processedAt).toEqual({ gte: range.start, lt: range.end });

    // il consumato filtra per consumedAt
    const ticketWhere = dbMock.ticket.findMany.mock.calls[0][0].where;
    expect(ticketWhere.consumedAt).toEqual({ gte: range.start, lt: range.end });
  });

  it("aggregateRefunds somma in valore assoluto (esposizione in negativo a valle)", () => {
    expect(aggregateRefunds(["10.00", "5.50"])).toEqual({ count: 2, total: "15.50" });
    expect(aggregateRefunds([])).toEqual({ count: 0, total: "0.00" });
  });
});

describe("export CSV", () => {
  it("una riga per fascia + totali, rimborsato in negativo", async () => {
    dbMock.orderItem.findMany.mockResolvedValue([
      { tierName: "Birra", quantity: 5, unitPrice: new Prisma.Decimal("6.00") },
    ]);
    dbMock.refund.findMany.mockResolvedValue([{ amount: new Prisma.Decimal("6.00") }]);
    dbMock.ticket.findMany.mockResolvedValue([
      {
        priceTierId: "t1",
        priceTier: { name: "Birra", price: new Prisma.Decimal("6.50") },
        order: { items: [{ priceTierId: "t1", unitPrice: new Prisma.Decimal("6.00") }] },
      },
    ]);

    const report = await getCorrispettivi("venue-1", dayRangeInTimezone("2026-07-15"));
    const lines = buildCorrispettiviCsv(report).split("\r\n");

    expect(lines[0]).toBe("Vista,Fascia,Quantita,Prezzo unitario,Totale");
    expect(lines).toContain("VENDUTO,Birra,5,6.00,30.00");
    expect(lines).toContain("VENDUTO,TOTALE VENDUTO,5,,30.00");
    expect(lines).toContain("RIMBORSATO,TOTALE RIMBORSATO (1 rimborsi),,,-6.00");
    // il consumato usa il prezzo PAGATO (snapshot ordine), non il listino attuale
    expect(lines).toContain("CONSUMATO,Birra,1,6.00,6.00");
    expect(lines).toContain("CONSUMATO,TOTALE CONSUMATO,1,,6.00");
  });
});
