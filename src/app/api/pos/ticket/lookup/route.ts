import { NextRequest, NextResponse } from "next/server";
import { requireStaff, StaffAuthError } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { computeTicketStatus } from "@/lib/tickets/status";
import { checkRateLimit, posLookupLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils/request";
import { z } from "zod";

const bodySchema = z.object({ qrToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireStaff();
  } catch (err) {
    const code = err instanceof StaffAuthError ? err.message : "UNAUTHORIZED_STAFF";
    return NextResponse.json(
      { ok: false, error: { code, message: "Sessione scaduta." } },
      { status: 401 }
    );
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(posLookupLimiter, `${session.operatorId}:${ip}`);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Troppi tentativi." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON" } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      { status: 422 }
    );
  }

  const { qrToken } = parsed.data;

  const ticket = await db.ticket.findUnique({
    where: { qrToken },
    include: {
      priceTier: { select: { name: true, price: true } },
      venue: { select: { id: true, name: true, slug: true } },
      operator: { select: { name: true } },
    },
  });

  if (!ticket) {
    return NextResponse.json(
      { ok: false, error: { code: "TICKET_NOT_FOUND" } },
      { status: 404 }
    );
  }

  if (ticket.venueId !== session.venueId) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "WRONG_VENUE" },
        data: { ticketVenue: ticket.venue.name },
      },
      { status: 400 }
    );
  }

  const effectiveStatus = computeTicketStatus(ticket);

  return NextResponse.json({
    ok: true,
    data: {
      ticketId: ticket.id,
      qrToken: ticket.qrToken,
      effectiveStatus,
      tier: { name: ticket.priceTier.name, price: ticket.priceTier.price.toString() },
      expiresAt: ticket.expiresAt.toISOString(),
      consumedAt: ticket.consumedAt?.toISOString() ?? null,
      consumedByName: ticket.operator?.name ?? null,
      refundedAt: ticket.refundedAt?.toISOString() ?? null,
    },
  });
}
