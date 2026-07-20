import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFiscalModuleConfigured } from "@/lib/fiscal/config";
import {
  enqueueSaleDocument,
  enqueueVoidDocument,
  runFiscalRetryBatch,
} from "@/lib/fiscal/emit";

export const dynamic = "force-dynamic";

// Cron di recupero fiscale (vercel.json, ogni 10 minuti): riprende i
// documenti PENDING maturi per il retry (backoff, max 10 tentativi) e — rete
// di sicurezza contro i troncamenti serverless — accoda i documenti mancanti
// delle ULTIME 24 ORE (mai backfill storico: abilitare il fiscale oggi non
// deve emettere documenti per gli ordini di ieri).
export async function GET(req: NextRequest) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET non configurato" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }

  if (!isFiscalModuleConfigured()) {
    return NextResponse.json({ ok: true, skipped: "modulo fiscale non configurato" });
  }

  const since = new Date(Date.now() - 24 * 3600_000);

  // Vendite delle ultime 24h senza documento (enqueue perso)
  const missingSales = await db.order.findMany({
    where: {
      paidAt: { gte: since },
      status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
      venue: { fiscalEnabled: true },
      fiscalDocuments: { none: { type: "SALE" } },
    },
    select: { id: true },
    take: 50,
  });
  for (const order of missingSales) {
    await enqueueSaleDocument(order.id).catch(console.error);
  }

  // Rimborsi completati delle ultime 24h senza storno
  const missingVoids = await db.refund.findMany({
    where: {
      status: "COMPLETED",
      processedAt: { gte: since },
      order: { venue: { fiscalEnabled: true } },
      fiscalDocument: null,
    },
    select: { id: true },
    take: 50,
  });
  for (const refund of missingVoids) {
    await enqueueVoidDocument(refund.id).catch(console.error);
  }

  const batch = await runFiscalRetryBatch();

  return NextResponse.json({
    ok: true,
    enqueuedSales: missingSales.length,
    enqueuedVoids: missingVoids.length,
    ...batch,
  });
}
