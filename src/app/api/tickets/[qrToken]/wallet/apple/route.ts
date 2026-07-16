import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAppleWalletConfigured } from "@/lib/wallet/config";
import { buildApplePass } from "@/lib/wallet/apple";

export const dynamic = "force-dynamic";

// Scarica il .pkpass del ticket. Il qrToken è già il segreto d'accesso alla
// pagina pubblica del ticket: chi possiede il link possiede il ticket, quindi
// non serve altra autenticazione (il cliente loggato ci arriva dalla sua
// pagina ticket con lo stesso token).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ qrToken: string }> }
) {
  if (!isAppleWalletConfigured()) {
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
      venue: { select: { name: true } },
    },
  });
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "Ticket non trovato" }, { status: 404 });
  }

  // Solo ticket ACTIVE e non scaduti: un pass per un ticket morto è un inganno
  if (ticket.status !== "ACTIVE" || ticket.expiresAt <= new Date()) {
    return NextResponse.json(
      { ok: false, error: "Il ticket non è più attivo" },
      { status: 410 }
    );
  }

  try {
    const pkpass = await buildApplePass({
      ticketId: ticket.id,
      qrToken: ticket.qrToken,
      tierName: ticket.priceTier.name,
      venueName: ticket.venue.name,
      expiresAt: ticket.expiresAt,
    });

    return new NextResponse(new Uint8Array(pkpass), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="klink-${ticket.id.slice(0, 8)}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Wallet Apple] generazione pass fallita:", error);
    return NextResponse.json(
      { ok: false, error: "Generazione del pass non riuscita" },
      { status: 500 }
    );
  }
}
