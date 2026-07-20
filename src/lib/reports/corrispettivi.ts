import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// Report corrispettivi giornaliero: il numero esatto che il locale batte come
// scontrino riepilogativo sul proprio registratore.
//
// Due basi distinte, perché commercialisti diversi scelgono basi diverse:
//   VENDUTO   = ordini pagati nel giorno (per data di pagamento, importo lordo)
//   CONSUMATO = ticket consumati nel giorno (per data di scansione al banco)
// I rimborsi completati nel giorno sono un totale SEPARATO (in negativo),
// mai sottratto dal venduto: il lordo per data di pagamento non cambia
// retroattivamente.
//
// La "giornata" è quella solare di Europe/Rome, non UTC: una serata che
// scavalca mezzanotte si divide tra i due giorni solari (23:50 → giorno
// prima, 00:10 → giorno dopo), come sul registratore di cassa.
// ─────────────────────────────────────────────────────────────────────────────

export const REPORT_TIMEZONE = "Europe/Rome";

export const FISCAL_DISCLAIMER =
  "Dato riepilogativo per la registrazione dei corrispettivi; la modalità di " +
  "fiscalizzazione va concordata col proprio consulente.";

// ── Giornata solare in un fuso ──────────────────────────────────────────────

// Offset del fuso per un dato istante (ms): differenza tra l'orologio locale
// e l'orologio UTC, calcolata con Intl (nessuna libreria).
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

export interface DayRange {
  start: Date; // incluso
  end: Date; // escluso
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function localMidnightUtc(y: number, m: number, d: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d);
  // due iterazioni per stabilizzare l'offset attraverso i cambi ora legale
  let ts = guess - tzOffsetMs(timeZone, new Date(guess));
  ts = guess - tzOffsetMs(timeZone, new Date(ts));
  return ts;
}

// Intervallo UTC [start, end) della giornata solare "YYYY-MM-DD" nel fuso.
export function dayRangeInTimezone(day: string, timeZone: string = REPORT_TIMEZONE): DayRange {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Giorno non valido: "${day}" (atteso YYYY-MM-DD)`);
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const dayNum = Number(d);
  return {
    start: new Date(localMidnightUtc(year, month, dayNum, timeZone)),
    end: new Date(localMidnightUtc(year, month, dayNum + 1, timeZone)),
  };
}

// Intervallo UTC [start, end) da "YYYY-MM-DD" a "YYYY-MM-DD" inclusi, nel fuso.
export function rangeInTimezone(
  fromDay: string,
  toDay: string,
  timeZone: string = REPORT_TIMEZONE
): DayRange {
  const start = dayRangeInTimezone(fromDay, timeZone).start;
  const end = dayRangeInTimezone(toDay, timeZone).end;
  if (end <= start) throw new Error("Intervallo non valido: la fine precede l'inizio");
  return { start, end };
}

// Giorno solare "YYYY-MM-DD" di un istante, nel fuso.
export function dayKeyInTimezone(date: Date, timeZone: string = REPORT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Il giorno solare precedente a "now" nel fuso (per il report di ieri).
export function yesterdayInTimezone(now: Date, timeZone: string = REPORT_TIMEZONE): string {
  const today = dayKeyInTimezone(now, timeZone);
  const m = DAY_RE.exec(today);
  if (!m) throw new Error(`Giorno non valido: ${today}`);
  const [, y, mo, d] = m;
  // mezzogiorno UTC per evitare qualunque effetto di fuso nel -1 giorno
  const prev = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d) - 1, 12));
  return dayKeyInTimezone(prev, "UTC");
}

// Normalizza i parametri giorno del report: default ieri (giornata solare
// del fuso), "a" mai prima di "da" (le date ISO si confrontano come stringhe).
export function parseReportDays(
  daParam: string | undefined,
  aParam: string | undefined,
  now: Date,
  timeZone: string = REPORT_TIMEZONE
): { da: string; a: string } {
  const yesterday = yesterdayInTimezone(now, timeZone);
  const da = daParam && DAY_RE.test(daParam) ? daParam : yesterday;
  const aValid = aParam && DAY_RE.test(aParam) ? aParam : da;
  return { da, a: aValid < da ? da : aValid };
}

// ── Aggregazioni pure (testabili) ───────────────────────────────────────────

export interface TierLine {
  tierName: string;
  quantity: number;
  unitPrice: string; // EUR, 2 decimali
  total: string; // quantity × unitPrice, EUR
}

export interface TierAggregate {
  rows: TierLine[];
  totalQuantity: number;
  total: string; // EUR
}

interface CountableItem {
  tierName: string;
  quantity: number;
  unitPrice: Prisma.Decimal | string;
}

// Raggruppa per fascia E prezzo unitario: se una fascia ha cambiato prezzo
// nel periodo, le due tariffe restano righe distinte (quantità × prezzo
// deve sempre tornare col totale).
export function aggregateByTier(items: CountableItem[]): TierAggregate {
  const groups = new Map<string, { tierName: string; quantity: number; unitPrice: Prisma.Decimal }>();
  for (const item of items) {
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const key = `${item.tierName}|${unitPrice.toFixed(2)}`;
    const group = groups.get(key);
    if (group) {
      group.quantity += item.quantity;
    } else {
      groups.set(key, { tierName: item.tierName, quantity: item.quantity, unitPrice });
    }
  }

  const rows = [...groups.values()]
    .sort((a, b) => a.tierName.localeCompare(b.tierName, "it") || a.unitPrice.comparedTo(b.unitPrice))
    .map((g) => ({
      tierName: g.tierName,
      quantity: g.quantity,
      unitPrice: g.unitPrice.toFixed(2),
      total: g.unitPrice.times(g.quantity).toFixed(2),
    }));

  const totalQuantity = rows.reduce((acc, r) => acc + r.quantity, 0);
  const total = rows
    .reduce((acc, r) => acc.plus(new Prisma.Decimal(r.total)), new Prisma.Decimal(0))
    .toFixed(2);

  return { rows, totalQuantity, total };
}

export interface RefundAggregate {
  count: number;
  total: string; // valore assoluto EUR: va esposto/battuto in negativo
}

export function aggregateRefunds(amounts: (Prisma.Decimal | string)[]): RefundAggregate {
  const total = amounts
    .reduce<Prisma.Decimal>((acc, a) => acc.plus(new Prisma.Decimal(a)), new Prisma.Decimal(0))
    .toFixed(2);
  return { count: amounts.length, total };
}

export interface CorrispettiviReport {
  sold: TierAggregate;
  refunded: RefundAggregate;
  consumed: TierAggregate;
}

export function hasMovements(report: CorrispettiviReport): boolean {
  return (
    report.sold.totalQuantity > 0 ||
    report.consumed.totalQuantity > 0 ||
    report.refunded.count > 0
  );
}

// ── Export CSV (puro) ───────────────────────────────────────────────────────

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Una riga per fascia + totali, per entrambe le viste; il rimborsato è una
// riga separata col segno negativo.
export function buildCorrispettiviCsv(report: CorrispettiviReport): string {
  const lines: string[] = ["Vista,Fascia,Quantita,Prezzo unitario,Totale"];

  for (const row of report.sold.rows) {
    lines.push(["VENDUTO", csvEscape(row.tierName), String(row.quantity), row.unitPrice, row.total].join(","));
  }
  lines.push(["VENDUTO", "TOTALE VENDUTO", String(report.sold.totalQuantity), "", report.sold.total].join(","));

  const refundTotal =
    report.refunded.total === "0.00" ? "0.00" : `-${report.refunded.total}`;
  lines.push(
    ["RIMBORSATO", `TOTALE RIMBORSATO (${report.refunded.count} rimborsi)`, "", "", refundTotal]
      .map(csvEscape)
      .join(",")
  );

  for (const row of report.consumed.rows) {
    lines.push(["CONSUMATO", csvEscape(row.tierName), String(row.quantity), row.unitPrice, row.total].join(","));
  }
  lines.push(
    ["CONSUMATO", "TOTALE CONSUMATO", String(report.consumed.totalQuantity), "", report.consumed.total].join(",")
  );

  return lines.join("\r\n");
}

// ── Riconciliazione fiscale ─────────────────────────────────────────────────

export interface FiscalReconciliation {
  // Somma dei documenti di VENDITA CONFERMATI per ordini pagati nel periodo
  confirmedTotal: string; // EUR
  confirmedCount: number;
  pendingCount: number; // PENDING/SUBMITTED (in attesa)
  failedCount: number; // errori definitivi
  missingCount: number; // ordini venduti senza alcun documento
  // sold.total − confirmedTotal: "0.00" quando tutto è stato emesso
  difference: string; // EUR
}

// Confronta il VENDUTO del periodo (per data di pagamento) con i documenti
// commerciali emessi per quegli stessi ordini: la differenza evidenzia cosa
// manca ancora all'appello (in attesa, in errore o mai accodato).
export function reconcileFiscal(
  soldTotal: string,
  docs: { status: string; total: Prisma.Decimal | string }[],
  soldOrderCount: number
): FiscalReconciliation {
  let confirmed = new Prisma.Decimal(0);
  let confirmedCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  for (const doc of docs) {
    if (doc.status === "CONFIRMED") {
      confirmed = confirmed.plus(new Prisma.Decimal(doc.total));
      confirmedCount += 1;
    } else if (doc.status === "FAILED") {
      failedCount += 1;
    } else {
      pendingCount += 1;
    }
  }
  return {
    confirmedTotal: confirmed.toFixed(2),
    confirmedCount,
    pendingCount,
    failedCount,
    missingCount: Math.max(0, soldOrderCount - docs.length),
    difference: new Prisma.Decimal(soldTotal).minus(confirmed).toFixed(2),
  };
}

export async function getFiscalReconciliation(
  venueId: string,
  range: DayRange,
  soldTotal: string
): Promise<FiscalReconciliation> {
  const [docs, soldOrderCount] = await Promise.all([
    db.fiscalDocument.findMany({
      where: {
        venueId,
        type: "SALE",
        order: {
          status: { in: [...SOLD_STATUSES] },
          paidAt: { gte: range.start, lt: range.end },
        },
      },
      select: { status: true, total: true },
    }),
    db.order.count({
      where: {
        venueId,
        status: { in: [...SOLD_STATUSES] },
        paidAt: { gte: range.start, lt: range.end },
      },
    }),
  ]);
  return reconcileFiscal(soldTotal, docs, soldOrderCount);
}

// ── Query ───────────────────────────────────────────────────────────────────

// VENDUTO lordo per data di pagamento: contano anche gli ordini poi rimborsati
// (status PARTIALLY_REFUNDED / REFUNDED) — il rimborso compare separato nel
// giorno in cui è stato completato, non riscrive il venduto passato.
const SOLD_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

export async function getCorrispettivi(venueId: string, range: DayRange): Promise<CorrispettiviReport> {
  const [soldItems, refunds, consumedTickets] = await Promise.all([
    db.orderItem.findMany({
      where: {
        order: {
          venueId,
          status: { in: [...SOLD_STATUSES] },
          paidAt: { gte: range.start, lt: range.end },
        },
      },
      select: { tierName: true, quantity: true, unitPrice: true },
    }),
    db.refund.findMany({
      where: {
        status: "COMPLETED",
        processedAt: { gte: range.start, lt: range.end },
        order: { venueId },
      },
      select: { amount: true },
    }),
    db.ticket.findMany({
      where: { venueId, consumedAt: { gte: range.start, lt: range.end } },
      select: {
        priceTierId: true,
        priceTier: { select: { name: true, price: true } },
        // prezzo pagato: snapshot sull'OrderItem della stessa fascia, così un
        // cambio listino successivo non altera il valore del consumato
        order: { select: { items: { select: { priceTierId: true, unitPrice: true } } } },
      },
    }),
  ]);

  return {
    sold: aggregateByTier(soldItems),
    refunded: aggregateRefunds(refunds.map((r) => r.amount)),
    consumed: aggregateByTier(
      consumedTickets.map((t) => ({
        tierName: t.priceTier.name,
        quantity: 1,
        unitPrice:
          t.order.items.find((i) => i.priceTierId === t.priceTierId)?.unitPrice ??
          t.priceTier.price,
      }))
    ),
  };
}
