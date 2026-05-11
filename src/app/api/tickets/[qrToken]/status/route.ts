import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeTicketStatus } from "@/lib/tickets/status";
import { checkRateLimit, ticketStatusLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils/request";

interface Ctx {
  params: Promise<{ qrToken: string }>;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { qrToken } = await params;

  const ip = getClientIp(req);
  const rl = await checkRateLimit(ticketStatusLimiter, ip);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Troppe richieste." } },
      { status: 429 }
    );
  }

  const ticket = await db.ticket.findUnique({
    where: { qrToken },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      consumedAt: true,
      refundedAt: true,
      priceTier: { select: { name: true, price: true } },
      venue: { select: { name: true, slug: true } },
    },
  });

  if (!ticket) {
    return NextResponse.json(
      { ok: false, error: { code: "TICKET_NOT_FOUND" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      effectiveStatus: computeTicketStatus(ticket),
      consumedAt: ticket.consumedAt?.toISOString() ?? null,
      refundedAt: ticket.refundedAt?.toISOString() ?? null,
      expiresAt: ticket.expiresAt.toISOString(),
      tier: { name: ticket.priceTier.name, price: ticket.priceTier.price.toString() },
      venue: { name: ticket.venue.name, slug: ticket.venue.slug },
    },
  });
}
