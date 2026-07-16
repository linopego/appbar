import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isGoogleWalletConfigured } from "@/lib/wallet/config";
import { buildGoogleSaveUrl } from "@/lib/wallet/google";

export const dynamic = "force-dynamic";

// Redirige al link "Salva su Google Wallet" del ticket. Stessa politica di
// accesso della pagina pubblica: il qrToken è il segreto.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ qrToken: string }> }
) {
  if (!isGoogleWalletConfigured()) {
    return NextResponse.json({ ok: false, error: "Non disponibile" }, { status: 404 });
  }

  const { qrToken } = await params;
  const ticket = await db.ticket.findUnique({
    where: { qrToken },
    select: {
      id: true,
      qrToken: true,
      status: true,
      expiresAt: true,
      priceTier: { select: { name: true } },
      venue: { select: { name: true, slug: true } },
    },
  });
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "Ticket non trovato" }, { status: 404 });
  }

  // Solo ticket ACTIVE e non scaduti
  if (ticket.status !== "ACTIVE" || ticket.expiresAt <= new Date()) {
    return NextResponse.json(
      { ok: false, error: "Il ticket non è più attivo" },
      { status: 410 }
    );
  }

  try {
    const saveUrl = await buildGoogleSaveUrl({
      ticketId: ticket.id,
      qrToken: ticket.qrToken,
      tierName: ticket.priceTier.name,
      venueName: ticket.venue.name,
      venueSlug: ticket.venue.slug,
      expiresAt: ticket.expiresAt,
    });
    return NextResponse.redirect(saveUrl, 302);
  } catch (error) {
    console.error("[Wallet Google] generazione link fallita:", error);
    return NextResponse.json(
      { ok: false, error: "Generazione del pass non riuscita" },
      { status: 500 }
    );
  }
}
