import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRefundCurrentlyBlocked, nextUnblockedTime, type RefundWindow } from "@/lib/refunds/blocked-windows";
import { computeTicketStatus } from "@/lib/tickets/status";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Non autenticato" }, { status: 401 });
  }

  const { orderId } = await params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      tickets: { include: { priceTier: true } },
      venue: true,
      refunds: { where: { status: { in: ["PENDING", "APPROVED"] } } },
    },
  });

  if (!order || order.customerId !== session.user.id) {
    return NextResponse.json({ ok: false, error: "Ordine non trovato" }, { status: 404 });
  }

  const inPendingRefundIds = new Set(
    order.refunds.flatMap((r) => r.ticketIds as string[])
  );

  const refundableTickets: Array<{ id: string; tierName: string; price: string; qrToken: string }> = [];
  const nonRefundableTickets: Array<{ id: string; tierName: string; price: string; reason: string }> = [];

  for (const ticket of order.tickets) {
    const effective = computeTicketStatus(ticket);
    const price = ticket.priceTier.price.toString();
    const tierName = ticket.priceTier.name;

    if (inPendingRefundIds.has(ticket.id)) {
      nonRefundableTickets.push({ id: ticket.id, tierName, price, reason: "IN_PENDING_REFUND" });
    } else if (effective === "ACTIVE") {
      refundableTickets.push({ id: ticket.id, tierName, price, qrToken: ticket.qrToken });
    } else {
      nonRefundableTickets.push({ id: ticket.id, tierName, price, reason: effective });
    }
  }

  const windows = (order.venue.refundBlockedWindows as RefundWindow[] | null) ?? [];
  const timezone = order.venue.refundBlockedTimezone;
  const blockedByTime = isRefundCurrentlyBlocked(windows, timezone);
  const nextTime = blockedByTime ? nextUnblockedTime(windows, timezone) : null;

  const eligible = !blockedByTime && refundableTickets.length > 0;

  return NextResponse.json({
    ok: true,
    data: {
      eligible,
      refundableTickets,
      nonRefundableTickets,
      blockedByTime,
      nextUnblockedTime: nextTime?.toISOString() ?? null,
      venueTimezone: timezone,
    },
  });
}
