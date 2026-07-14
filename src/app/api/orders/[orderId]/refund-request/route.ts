import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRefundCurrentlyBlocked, type RefundWindow } from "@/lib/refunds/blocked-windows";
import { computeTicketStatus } from "@/lib/tickets/status";
import { checkRateLimit, refundRequestLimiter } from "@/lib/ratelimit";
import {
  sendRefundRequestedEmail,
  sendRefundNewForManagerEmail,
} from "@/lib/email/refund-emails";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const rl = await checkRateLimit(refundRequestLimiter, session.user.id);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED" } },
      { status: 429 }
    );
  }

  const { orderId } = await params;
  let body: { ticketIds?: string[]; customerNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "INVALID_BODY" } }, { status: 400 });
  }

  const customerNote = (body.customerNote ?? "").trim();
  if (!customerNote || customerNote.length < 10) {
    return NextResponse.json(
      { ok: false, error: { code: "REASON_TOO_SHORT", message: "Inserisci una motivazione di almeno 10 caratteri" } },
      { status: 400 }
    );
  }

  const requestedTicketIds = body.ticketIds ?? [];

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      tickets: { include: { priceTier: true } },
      venue: {
        include: {
          operators: { where: { role: "MANAGER", active: true, email: { not: null } } },
        },
      },
      customer: true,
      refunds: { where: { status: { in: ["PENDING", "APPROVED"] } } },
    },
  });

  if (!order || order.customerId !== session.user.id) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  if (!["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_ORDER_STATE" } },
      { status: 422 }
    );
  }

  // Ticket IDs already in a pending/approved refund
  const alreadyInRefundIds = new Set(
    order.refunds.flatMap((r) => r.ticketIds as string[])
  );

  // If ticketIds specified, filter to those; otherwise use all active tickets
  const candidateTickets = requestedTicketIds.length > 0
    ? order.tickets.filter((t) => requestedTicketIds.includes(t.id))
    : order.tickets;

  // Validate requested IDs all belong to this order
  if (requestedTicketIds.length > 0 && candidateTickets.length !== requestedTicketIds.length) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_TICKETS" } },
      { status: 400 }
    );
  }

  // Check for tickets already in a refund
  const inRefundTickets = candidateTickets.filter((t) => alreadyInRefundIds.has(t.id));
  if (inRefundTickets.length > 0) {
    return NextResponse.json(
      { ok: false, error: { code: "TICKETS_ALREADY_IN_REFUND" } },
      { status: 422 }
    );
  }

  // Only keep ACTIVE tickets
  const activeTickets = candidateTickets.filter(
    (t) => computeTicketStatus(t) === "ACTIVE"
  );

  if (activeTickets.length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: "TICKETS_NOT_REFUNDABLE" } },
      { status: 422 }
    );
  }

  const windows = (order.venue.refundBlockedWindows as RefundWindow[] | null) ?? [];
  const timezone = order.venue.refundBlockedTimezone;
  if (isRefundCurrentlyBlocked(windows, timezone)) {
    return NextResponse.json(
      { ok: false, error: { code: "REFUND_BLOCKED_BY_TIME" } },
      { status: 422 }
    );
  }

  const totalAmount = activeTickets
    .reduce((sum, t) => sum + Number(t.priceTier.price), 0)
    .toFixed(2);

  const refund = await db.refund.create({
    data: {
      orderId: order.id,
      amount: totalAmount,
      ticketIds: activeTickets.map((t) => t.id),
      reason: customerNote,
      customerNote,
      status: "PENDING",
    },
  });

  const customerName = order.customer.firstName ?? order.customer.email ?? "Cliente";
  const customerEmail = order.customer.email!;

  void sendRefundRequestedEmail({
    customerEmail,
    customerName,
    venueName: order.venue.name,
    refundId: refund.id,
    amount: totalAmount,
    ticketCount: activeTickets.length,
    reason: customerNote,
  }).catch(console.error);

  for (const manager of order.venue.operators) {
    if (!manager.email) continue;
    void sendRefundNewForManagerEmail({
      managerEmail: manager.email,
      managerName: manager.name,
      customerName,
      customerEmail,
      venueName: order.venue.name,
      refundId: refund.id,
      amount: totalAmount,
      ticketCount: activeTickets.length,
      reason: customerNote,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, data: { refundId: refund.id } }, { status: 201 });
}
