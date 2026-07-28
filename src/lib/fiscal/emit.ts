import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isFiscalModuleConfigured } from "./config";
import { OpenapiFiscalProvider } from "./openapi-provider";
import {
  FiscalProviderError,
  type FiscalLine,
  type FiscalProvider,
  type FiscalVenueConfig,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Macchina a stati del FiscalDocument. Il flusso di vendita/rimborso NON
// dipende mai da queste funzioni: chi le chiama le avvolge in try/catch e
// prosegue comunque (l'emissione è asincrona, ritentabile, osservabile).
//
// PENDING → (emissione) → CONFIRMED
//         → errore ritentabile → PENDING (attempts+1, backoff, max 10)
//         → errore definitivo o tentativi esauriti → FAILED
// SUBMITTED = inviato, esito non definitivo (stati intermedi del provider).
// ─────────────────────────────────────────────────────────────────────────────

export const FISCAL_MAX_ATTEMPTS = 10;

const defaultProvider: FiscalProvider = new OpenapiFiscalProvider();

// Backoff esponenziale in minuti, cap a 60 (il cron gira ogni 10)
export function backoffMinutes(attempts: number): number {
  return Math.min(2 ** attempts, 60);
}

export function isDueForRetry(
  doc: { attempts: number; updatedAt: Date },
  now: Date
): boolean {
  return now.getTime() - doc.updatedAt.getTime() >= backoffMinutes(doc.attempts) * 60_000;
}

// Precondizioni di attivazione per venue: aliquota su TUTTI i tier attivi
// e configurazione esercente presente.
export function canEnableFiscal(
  activeTiers: { name: string; vatRate: Prisma.Decimal | string | null }[],
  fiscalConfig: unknown
): { ok: boolean; reason?: string } {
  const missing = activeTiers.filter((t) => t.vatRate === null || t.vatRate === undefined);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Aliquota IVA mancante su: ${missing.map((t) => t.name).join(", ")}`,
    };
  }
  if (!fiscalConfig || typeof fiscalConfig !== "object") {
    return { ok: false, reason: "Configurazione esercente assente (a cura della piattaforma)" };
  }
  return { ok: true };
}

interface SnapshotLine extends FiscalLine {
  [key: string]: string | number; // Json-friendly per Prisma
}

// ── Accodamento (idempotente) ───────────────────────────────────────────────

// Crea (se non esiste) il documento di VENDITA per un ordine pagato.
// Idempotente: findFirst + indice unico parziale sul DB come rete di
// sicurezza (P2002 → documento già creato da una richiesta concorrente).
export async function enqueueSaleDocument(orderId: string): Promise<string | null> {
  if (!isFiscalModuleConfigured()) return null;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalAmount: true,
      venue: { select: { id: true, fiscalEnabled: true } },
      items: {
        select: {
          tierName: true,
          quantity: true,
          unitPrice: true,
          priceTier: { select: { vatRate: true } },
        },
      },
    },
  });
  if (!order || !order.venue.fiscalEnabled) return null;

  const existing = await db.fiscalDocument.findFirst({
    where: { orderId, type: "SALE" },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Snapshot delle righe con l'aliquota del momento
  const lines: SnapshotLine[] = order.items.map((item) => ({
    description: item.tierName,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    vatRate: item.priceTier.vatRate?.toFixed(2) ?? "",
  }));

  try {
    const doc = await db.fiscalDocument.create({
      data: {
        orderId,
        venueId: order.venue.id,
        type: "SALE",
        status: "PENDING",
        total: order.totalAmount,
        lines,
      },
      select: { id: true },
    });
    return doc.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const race = await db.fiscalDocument.findFirst({
        where: { orderId, type: "SALE" },
        select: { id: true },
      });
      return race?.id ?? null;
    }
    throw error;
  }
}

// Crea (se non esiste) il documento di STORNO per un rimborso completato.
// Solo se la vendita ha un documento CONFIRMED da stornare.
export async function enqueueVoidDocument(refundId: string): Promise<string | null> {
  if (!isFiscalModuleConfigured()) return null;

  const refund = await db.refund.findUnique({
    where: { id: refundId },
    select: {
      id: true,
      amount: true,
      ticketIds: true,
      order: {
        select: {
          id: true,
          totalAmount: true,
          venue: { select: { id: true, fiscalEnabled: true } },
          items: {
            select: {
              priceTierId: true,
              tierName: true,
              unitPrice: true,
              priceTier: { select: { vatRate: true } },
            },
          },
        },
      },
    },
  });
  if (!refund || !refund.order.venue.fiscalEnabled) return null;

  const sale = await db.fiscalDocument.findFirst({
    where: { orderId: refund.order.id, type: "SALE", status: "CONFIRMED" },
    select: { id: true },
  });
  if (!sale) return null; // niente da stornare (vendita non ancora emessa)

  const existing = await db.fiscalDocument.findUnique({
    where: { refundId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Righe del reso: i ticket rimborsati raggruppati per fascia
  const tickets = await db.ticket.findMany({
    where: { id: { in: refund.ticketIds } },
    select: { priceTierId: true },
  });
  const itemByTier = new Map(refund.order.items.map((i) => [i.priceTierId, i]));
  const counts = new Map<string, number>();
  for (const t of tickets) counts.set(t.priceTierId, (counts.get(t.priceTierId) ?? 0) + 1);
  const lines: SnapshotLine[] = [...counts.entries()].map(([tierId, qty]) => {
    const item = itemByTier.get(tierId);
    return {
      description: item?.tierName ?? "Reso",
      quantity: qty,
      unitPrice: item?.unitPrice.toFixed(2) ?? new Prisma.Decimal(refund.amount).toFixed(2),
      vatRate: item?.priceTier.vatRate?.toFixed(2) ?? "",
    };
  });

  try {
    const doc = await db.fiscalDocument.create({
      data: {
        orderId: refund.order.id,
        refundId,
        venueId: refund.order.venue.id,
        type: "VOID",
        status: "PENDING",
        total: refund.amount,
        lines,
      },
      select: { id: true },
    });
    return doc.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const race = await db.fiscalDocument.findUnique({
        where: { refundId },
        select: { id: true },
      });
      return race?.id ?? null;
    }
    throw error;
  }
}

// ── Emissione ───────────────────────────────────────────────────────────────

function parseLines(lines: unknown): FiscalLine[] {
  if (!Array.isArray(lines)) return [];
  return lines as FiscalLine[];
}

// Lavora UN documento: chiama il provider e aggiorna lo stato.
// Mai eccezioni verso il chiamante per esiti fiscali: lo stato è nel DB.
export async function processFiscalDocument(
  documentId: string,
  provider: FiscalProvider = defaultProvider
): Promise<"CONFIRMED" | "PENDING" | "FAILED" | "SKIPPED"> {
  const doc = await db.fiscalDocument.findUnique({
    where: { id: documentId },
    include: {
      venue: { select: { fiscalConfig: true } },
      order: { select: { totalAmount: true } },
    },
  });
  if (!doc) return "SKIPPED";
  if (doc.status === "CONFIRMED" || doc.status === "FAILED") return "SKIPPED";

  const lines = parseLines(doc.lines);
  const config = (doc.venue.fiscalConfig ?? {}) as FiscalVenueConfig;

  try {
    // Precondizione non ritentabile: righe senza aliquota
    if (lines.length === 0 || lines.some((l) => !l.vatRate)) {
      throw new FiscalProviderError("Righe senza aliquota IVA: configura il listino", false);
    }

    let result;
    if (doc.type === "SALE") {
      result = await provider.emitSaleDocument({
        idempotencyKey: doc.id,
        total: doc.total.toFixed(2),
        lines,
        venueFiscalConfig: config,
      });
    } else {
      // VOID: serve il documento di vendita confermato da stornare
      const sale = await db.fiscalDocument.findFirst({
        where: { orderId: doc.orderId, type: "SALE", status: "CONFIRMED" },
        select: { providerDocId: true },
      });
      if (!sale?.providerDocId) {
        throw new FiscalProviderError("Documento di vendita non ancora emesso", true);
      }
      const full = new Prisma.Decimal(doc.total).greaterThanOrEqualTo(doc.order.totalAmount);
      result = await provider.emitVoidDocument({
        idempotencyKey: doc.id,
        originalProviderDocId: sale.providerDocId,
        amount: doc.total.toFixed(2),
        full,
        lines,
        venueFiscalConfig: config,
      });
    }

    await db.fiscalDocument.update({
      where: { id: doc.id },
      data: {
        status: "CONFIRMED",
        attempts: doc.attempts + 1,
        lastError: null,
        providerDocId: result.providerDocId,
        protocolNumber: result.protocolNumber ?? null,
        pdfUrl: result.pdfUrl ?? null,
      },
    });
    return "CONFIRMED";
  } catch (error) {
    const attempts = doc.attempts + 1;
    const retryable = error instanceof FiscalProviderError ? error.retryable : true;
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    const failed = !retryable || attempts >= FISCAL_MAX_ATTEMPTS;

    await db.fiscalDocument.update({
      where: { id: doc.id },
      data: {
        status: failed ? "FAILED" : "PENDING",
        attempts,
        lastError: message.slice(0, 1000),
      },
    });
    return failed ? "FAILED" : "PENDING";
  }
}

// Accoda e tenta subito, best-effort: QUALUNQUE errore resta qui dentro.
export async function enqueueAndTrySaleDocument(orderId: string): Promise<void> {
  try {
    const docId = await enqueueSaleDocument(orderId);
    if (docId) await processFiscalDocument(docId);
  } catch (error) {
    console.error(`[Fiscale] emissione vendita per ordine ${orderId} rinviata al cron:`, error);
  }
}

export async function enqueueAndTryVoidDocument(refundId: string): Promise<void> {
  try {
    const docId = await enqueueVoidDocument(refundId);
    if (docId) await processFiscalDocument(docId);
  } catch (error) {
    console.error(`[Fiscale] storno per rimborso ${refundId} rinviato al cron:`, error);
  }
}

// Batch del cron di recupero: PENDING/SUBMITTED maturi per il retry.
export async function runFiscalRetryBatch(
  limit = 25,
  provider: FiscalProvider = defaultProvider
): Promise<{ processed: number; confirmed: number; failed: number }> {
  const now = new Date();
  const candidates = await db.fiscalDocument.findMany({
    where: { status: { in: ["PENDING", "SUBMITTED"] } },
    orderBy: { updatedAt: "asc" },
    take: limit * 2, // il filtro di backoff è applicativo
    select: { id: true, attempts: true, updatedAt: true },
  });

  let processed = 0;
  let confirmed = 0;
  let failed = 0;
  for (const doc of candidates) {
    if (processed >= limit) break;
    if (!isDueForRetry(doc, now)) continue;
    processed += 1;
    const outcome = await processFiscalDocument(doc.id, provider);
    if (outcome === "CONFIRMED") confirmed += 1;
    if (outcome === "FAILED") failed += 1;
  }
  return { processed, confirmed, failed };
}
