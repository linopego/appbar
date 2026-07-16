import type { TierAggregate } from "@/lib/reports/corrispettivi";

// ─────────────────────────────────────────────────────────────────────────────
// Giornata OPERATIVA (per la dashboard "Serata live"): dalle 06:00 alle 06:00
// Europe/Rome. Le 01:30 di sabato appartengono alla serata di venerdì.
//
// NON è la giornata dei Corrispettivi (R15): quella è SOLARE (00:00–24:00),
// perché la fiscalizzazione segue il giorno di calendario. Due definizioni
// diverse per scopi diversi, entrambe corrette:
//   - corrispettivi.ts → giornata solare, per battere lo scontrino
//   - operational-day  → serata 06→06, per guardare la serata mentre accade
// ─────────────────────────────────────────────────────────────────────────────

export const OPERATIONAL_TIMEZONE = "Europe/Rome";
export const OPERATIONAL_DAY_START_HOUR = 6;

// Offset del fuso per un dato istante (stessa tecnica Intl di corrispettivi.ts,
// duplicata di proposito: R15 non va toccato).
function tzOffsetMs(timeZone: string, utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(utcDate)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const hour = parts["hour"] === "24" ? "0" : (parts["hour"] ?? "0");
  const asUtc = Date.UTC(
    Number(parts["year"] ?? "1970"),
    Number(parts["month"] ?? "1") - 1,
    Number(parts["day"] ?? "1"),
    Number(hour),
    Number(parts["minute"] ?? "0"),
    Number(parts["second"] ?? "0")
  );
  return asUtc - Math.floor(utcDate.getTime() / 1000) * 1000;
}

// Istante UTC delle ore "hour:00" locali del giorno (y, m, d) nel fuso,
// stabile attraverso i cambi di ora legale (due iterazioni).
function localTimeUtc(y: number, m: number, d: number, hour: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d, hour);
  let ts = guess - tzOffsetMs(timeZone, new Date(guess));
  ts = guess - tzOffsetMs(timeZone, new Date(ts));
  return ts;
}

// Componenti della data/ora locale di un istante nel fuso.
function localParts(date: Date, timeZone: string): { y: number; m: number; d: number; hour: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    y: Number(parts["year"] ?? "1970"),
    m: Number(parts["month"] ?? "1"),
    d: Number(parts["day"] ?? "1"),
    hour: Number(parts["hour"] === "24" ? "0" : (parts["hour"] ?? "0")),
  };
}

export interface OperationalDay {
  /** "YYYY-MM-DD" della SERATA (la data in cui è iniziata, non quella corrente) */
  key: string;
  start: Date; // 06:00 locali, incluso
  end: Date; // 06:00 locali del giorno dopo, escluso
}

// La giornata operativa che contiene "now": prima delle 06:00 locali siamo
// ancora nella serata del giorno precedente.
export function operationalDayRange(
  now: Date,
  timeZone: string = OPERATIONAL_TIMEZONE
): OperationalDay {
  const local = localParts(now, timeZone);
  // mezzogiorno UTC come base neutra per l'aritmetica di calendario (-1 giorno)
  const base = new Date(Date.UTC(local.y, local.m - 1, local.d, 12));
  if (local.hour < OPERATIONAL_DAY_START_HOUR) base.setUTCDate(base.getUTCDate() - 1);

  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = base.getUTCDate();

  const start = new Date(localTimeUtc(y, m, d, OPERATIONAL_DAY_START_HOUR, timeZone));
  const end = new Date(localTimeUtc(y, m, d + 1, OPERATIONAL_DAY_START_HOUR, timeZone));
  const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { key, start, end };
}

// ── Aggregazioni pure per la dashboard ──────────────────────────────────────

export interface LiveTierRow {
  tierName: string;
  unitPrice: string;
  soldQuantity: number;
  soldTotal: string;
  consumedQuantity: number;
  consumedTotal: string;
}

// Affianca venduto e consumato per fascia (riusa i TierAggregate dell'R15).
export function mergeTierAggregates(sold: TierAggregate, consumed: TierAggregate): LiveTierRow[] {
  const rows = new Map<string, LiveTierRow>();
  const ensure = (tierName: string, unitPrice: string): LiveTierRow => {
    const key = `${tierName}|${unitPrice}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        tierName,
        unitPrice,
        soldQuantity: 0,
        soldTotal: "0.00",
        consumedQuantity: 0,
        consumedTotal: "0.00",
      };
      rows.set(key, row);
    }
    return row;
  };

  for (const r of sold.rows) {
    const row = ensure(r.tierName, r.unitPrice);
    row.soldQuantity = r.quantity;
    row.soldTotal = r.total;
  }
  for (const r of consumed.rows) {
    const row = ensure(r.tierName, r.unitPrice);
    row.consumedQuantity = r.quantity;
    row.consumedTotal = r.total;
  }

  return [...rows.values()].sort(
    (a, b) => a.tierName.localeCompare(b.tierName, "it") || a.unitPrice.localeCompare(b.unitPrice)
  );
}

export interface HourBucket {
  /** etichetta locale "06".."05" nell'ordine della serata */
  hour: string;
  count: number;
}

// Consumazioni per ora della serata: 24 bucket a partire dalle 06:00 locali.
// L'ora è quella LOCALE del fuso (l'1:30 finisce nel bucket "01").
export function hourlyBuckets(
  consumedAts: Date[],
  timeZone: string = OPERATIONAL_TIMEZONE
): HourBucket[] {
  const counts = new Map<number, number>();
  const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, hour: "2-digit" });
  for (const at of consumedAts) {
    const raw = hourFmt.format(at);
    const hour = Number(raw === "24" ? "0" : raw) % 24;
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  const buckets: HourBucket[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = (OPERATIONAL_DAY_START_HOUR + i) % 24;
    buckets.push({ hour: String(hour).padStart(2, "0"), count: counts.get(hour) ?? 0 });
  }
  return buckets;
}
