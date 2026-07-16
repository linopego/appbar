import { describe, it, expect } from "vitest";
import {
  hourlyBuckets,
  mergeTierAggregates,
  operationalDayRange,
} from "@/lib/reports/operational-day";
import { aggregateByTier } from "@/lib/reports/corrispettivi";

// Giornata OPERATIVA della "Serata live": 06:00→06:00 Europe/Rome. Le 01:30
// di sabato appartengono alla serata di venerdì. NON è la giornata solare dei
// Corrispettivi: due definizioni diverse per scopi diversi.

describe("operationalDayRange", () => {
  it("01:30 di sabato → serata di venerdì", () => {
    // Sabato 18/7/2026 01:30 in Italia (estate, UTC+2) = venerdì 17/7 23:30Z
    const now = new Date("2026-07-17T23:30:00Z");
    const day = operationalDayRange(now);
    expect(day.key).toBe("2026-07-17"); // la serata è quella di venerdì
    expect(day.start.toISOString()).toBe("2026-07-17T04:00:00.000Z"); // 06:00 locali
    expect(day.end.toISOString()).toBe("2026-07-18T04:00:00.000Z");
    expect(now >= day.start && now < day.end).toBe(true);
  });

  it("07:00 → serata del giorno stesso", () => {
    // Venerdì 17/7/2026 07:00 in Italia = 05:00Z
    const now = new Date("2026-07-17T05:00:00Z");
    const day = operationalDayRange(now);
    expect(day.key).toBe("2026-07-17");
    expect(day.start.toISOString()).toBe("2026-07-17T04:00:00.000Z");
  });

  it("05:59 → ancora la serata precedente; 06:00 → quella nuova", () => {
    // 05:59 locali del 18/7 = 03:59Z
    expect(operationalDayRange(new Date("2026-07-18T03:59:00Z")).key).toBe("2026-07-17");
    // 06:00 locali del 18/7 = 04:00Z
    expect(operationalDayRange(new Date("2026-07-18T04:00:00Z")).key).toBe("2026-07-18");
  });

  it("inverno (CET, UTC+1): 01:30 → serata del giorno prima", () => {
    // Sabato 17/1/2026 01:30 in Italia = venerdì 16/1 00:30Z... no: 01:30 CET = 00:30Z del 17
    const now = new Date("2026-01-17T00:30:00Z");
    const day = operationalDayRange(now);
    expect(day.key).toBe("2026-01-16");
    expect(day.start.toISOString()).toBe("2026-01-16T05:00:00.000Z"); // 06:00 CET
  });

  it("mezzanotte a cavallo: 23:50 e 00:10 stanno nella STESSA serata", () => {
    const at2350 = new Date("2026-07-17T21:50:00Z"); // 23:50 locali del 17
    const at0010 = new Date("2026-07-17T22:10:00Z"); // 00:10 locali del 18
    const day = operationalDayRange(at2350);
    expect(at2350 >= day.start && at2350 < day.end).toBe(true);
    expect(at0010 >= day.start && at0010 < day.end).toBe(true); // stessa serata!
  });
});

describe("aggregazioni della serata", () => {
  it("mergeTierAggregates affianca venduto e consumato per fascia", () => {
    const sold = aggregateByTier([
      { tierName: "Birra", quantity: 10, unitPrice: "6.00" },
      { tierName: "Acqua", quantity: 3, unitPrice: "3.00" },
    ]);
    const consumed = aggregateByTier([
      { tierName: "Birra", quantity: 4, unitPrice: "6.00" },
      { tierName: "Drink", quantity: 2, unitPrice: "8.00" },
    ]);
    const rows = mergeTierAggregates(sold, consumed);
    expect(rows).toEqual([
      { tierName: "Acqua", unitPrice: "3.00", soldQuantity: 3, soldTotal: "9.00", consumedQuantity: 0, consumedTotal: "0.00" },
      { tierName: "Birra", unitPrice: "6.00", soldQuantity: 10, soldTotal: "60.00", consumedQuantity: 4, consumedTotal: "24.00" },
      { tierName: "Drink", unitPrice: "8.00", soldQuantity: 0, soldTotal: "0.00", consumedQuantity: 2, consumedTotal: "16.00" },
    ]);
  });

  it("hourlyBuckets: 24 bucket dalle 06 alle 05, ora LOCALE italiana", () => {
    const buckets = hourlyBuckets([
      new Date("2026-07-17T20:15:00Z"), // 22:15 locali
      new Date("2026-07-17T20:45:00Z"), // 22:45 locali
      new Date("2026-07-17T23:30:00Z"), // 01:30 locali (dopo mezzanotte)
    ]);
    expect(buckets).toHaveLength(24);
    expect(buckets[0]?.hour).toBe("06"); // la serata parte dalle 06
    expect(buckets[23]?.hour).toBe("05");
    expect(buckets.find((b) => b.hour === "22")?.count).toBe(2);
    expect(buckets.find((b) => b.hour === "01")?.count).toBe(1);
    expect(buckets.reduce((acc, b) => acc + b.count, 0)).toBe(3);
  });
});
