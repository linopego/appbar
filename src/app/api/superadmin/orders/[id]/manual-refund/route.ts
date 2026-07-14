import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";
import { Prisma } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;

  let body: { reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { reason } = body;
  if (typeof reason !== "string" || reason.trim().length < 10) {
    return NextResponse.json({ ok: false, error: "reason deve essere almeno 10 caratteri" }, { status: 400 });
  }

  const order = await db.order.findUnique({
    where: { id },
    include: { tickets: { where: { status: "ACTIVE" } } },
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Ordine non trovato" }, { status: 404 });
  }

  if (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED") {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_ORDER_STATUS", status: order.status } },
      { status: 422 }
    );
  }

  const activeRefund = await db.refund.findFirst({
    where: { orderId: id, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (activeRefund) {
    return NextResponse.json(
      { ok: false, error: { code: "ACTIVE_REFUND_EXISTS", refundId: activeRefund.id } },
      { status: 422 }
    );
  }

  const activeTickets = order.tickets;
  if (activeTickets.length === 0) {
    return NextResponse.json({ ok: false, error: { code: "NO_ACTIVE_TICKETS" } }, { status: 422 });
  }

  const ticketIds = activeTickets.map((t) => t.id);

  // Sum totalAmount from tickets via their priceTiers
  const ticketsWithPrice = await db.ticket.findMany({
    where: { id: { in: ticketIds } },
    include: { priceTier: { select: { price: true } } },
  });

  const totalAmount = ticketsWithPrice.reduce(
    (sum, t) => sum.add(t.priceTier.price),
    new Prisma.Decimal(0)
  );

  if (!order.stripePaymentId) {
    return NextResponse.json({ ok: false, error: { code: "NO_PAYMENT_ID" } }, { status: 422 });
  }

  // Create refund record with APPROVED status
  const refundRecord = await db.refund.create({
    data: {
      orderId: id,
      amount: totalAmount,
      ticketIds,
      reason: reason.trim(),
      status: "APPROVED",
      stripeRefundId: null,
    },
  });

  // Execute Stripe refund
  const stripeRefund = await stripe.refunds.create({
    payment_intent: order.stripePaymentId,
    amount: Math.round(Number(totalAmount) * 100),
  });

  const now = new Date();

  // Update refund to COMPLETED and tickets to REFUNDED, then recalculate order status
  await db.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refundRecord.id },
      data: {
        status: "COMPLETED",
        stripeRefundId: stripeRefund.id,
        processedAt: now,
        processedBy: session.adminUserId,
        processedByType: "ADMIN_USER",
      },
    });

    await tx.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status: "REFUNDED", refundedAt: now },
    });

    // Determine final order status
    const remainingActive = await tx.ticket.count({
      where: { orderId: id, status: "ACTIVE" },
    });

    const newOrderStatus = remainingActive === 0 ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.order.update({
      where: { id },
      data: { status: newOrderStatus },
    });
  });

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: "ORDER_MANUAL_REFUND",
    targetType: "Order",
    targetId: id,
    payload: { orderId: id, amount: totalAmount.toString(), ticketIds, reason: reason.trim() },
  });

  return NextResponse.json({ ok: true, data: { refundId: refundRecord.id } });
}
