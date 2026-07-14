import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { processRefund } from "@/lib/refunds/process";
import { Prisma } from "@prisma/client";

// Rimborso manuale super-admin: crea il record Refund in PENDING e lo processa
// con la stessa macchina a stati dell'approvazione (claim atomico + idempotency
// key Stripe + finalizzazione). Vedi src/lib/refunds/process.ts.
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

  // PROCESSING e FAILED contano come attivi: un refund fallito va ritentato
  // (è rientrabile), non duplicato con un nuovo record.
  const activeRefund = await db.refund.findFirst({
    where: { orderId: id, status: { in: ["PENDING", "PROCESSING", "APPROVED", "FAILED"] } },
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

  // Record in PENDING: sarà la macchina a stati a portarlo a COMPLETED.
  const refundRecord = await db.refund.create({
    data: {
      orderId: id,
      amount: totalAmount,
      ticketIds,
      reason: reason.trim(),
      status: "PENDING",
      stripeRefundId: null,
    },
  });

  const result = await processRefund({
    refundId: refundRecord.id,
    actor: { processedBy: session.adminUserId, processedByType: "ADMIN_USER" },
  });

  if (!result.ok) {
    switch (result.code) {
      case "ALREADY_PROCESSED":
        return NextResponse.json(
          { ok: false, error: { code: "ALREADY_PROCESSED", refundId: refundRecord.id } },
          { status: 409 }
        );
      case "TICKETS_CHANGED":
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "TICKETS_CHANGED",
              refundId: refundRecord.id,
              invalidTicketIds: result.invalidTicketIds,
            },
          },
          { status: 409 }
        );
      case "STRIPE_ERROR":
        return NextResponse.json(
          { ok: false, error: { code: "STRIPE_ERROR", refundId: refundRecord.id } },
          { status: 502 }
        );
    }
  }

  await logAdminAction({
    adminUserId: session.adminUserId,
    action: "ORDER_MANUAL_REFUND",
    targetType: "Order",
    targetId: id,
    payload: { orderId: id, amount: totalAmount.toString(), ticketIds, reason: reason.trim() },
  });

  return NextResponse.json({ ok: true, data: { refundId: refundRecord.id } });
}
