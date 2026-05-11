import { NextRequest, NextResponse } from "next/server";
import { getAdminOrManagerSession } from "@/lib/auth/admin-or-manager";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";
import { sendRefundApprovedEmail } from "@/lib/email/refund-emails";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const session = await getAdminOrManagerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Non autenticato" }, { status: 401 });
  }

  const { refundId } = await params;
  let body: { managerNote?: string } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: {
      order: {
        include: {
          customer: true,
          venue: true,
        },
      },
    },
  });

  if (!refund) {
    return NextResponse.json({ ok: false, error: "Rimborso non trovato" }, { status: 404 });
  }

  // Manager can only approve their venue's refunds
  if (session.kind === "manager" && refund.order.venueId !== session.session.venueId) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 403 });
  }

  if (refund.status !== "PENDING") {
    return NextResponse.json(
      { ok: false, error: "Il rimborso non è in stato PENDING" },
      { status: 422 }
    );
  }

  const processedBy =
    session.kind === "admin" ? session.session.adminUserId : session.session.operatorId;
  const processedByType =
    session.kind === "admin" ? "ADMIN_USER" : "OPERATOR";

  // Issue Stripe refund
  const order = refund.order;
  let stripeRefundId: string | null = null;

  if (order.stripePaymentId) {
    try {
      const stripeRefund = await stripe.refunds.create({
        payment_intent: order.stripePaymentId,
        amount: Math.round(Number(refund.amount) * 100), // cents
      });
      stripeRefundId = stripeRefund.id;
    } catch (err) {
      console.error("[Refund] Stripe refund failed:", err);
      return NextResponse.json(
        { ok: false, error: "Errore durante il rimborso Stripe" },
        { status: 502 }
      );
    }
  }

  // Atomic update: refund → APPROVED/COMPLETED, tickets → REFUNDED, order → REFUNDED/PARTIALLY_REFUNDED
  await db.$transaction(async (tx) => {
    const ticketIds = refund.ticketIds as string[];
    const now = new Date();

    await tx.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status: "REFUNDED", refundedAt: now },
    });

    const allTickets = await tx.ticket.findMany({
      where: { orderId: order.id },
      select: { status: true },
    });
    const allRefunded = allTickets.every((t) => t.status === "REFUNDED" || t.status === "CONSUMED");
    const anyActive = allTickets.some((t) => t.status === "ACTIVE");

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: anyActive ? "PARTIALLY_REFUNDED" : "REFUNDED",
      },
    });

    const newStatus = stripeRefundId ? "COMPLETED" : "APPROVED";
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: newStatus,
        stripeRefundId,
        managerNote: body.managerNote?.trim() || null,
        processedAt: now,
        processedBy,
        processedByType,
      },
    });

    // Audit log for admin actions
    if (session.kind === "admin") {
      await tx.adminAuditLog.create({
        data: {
          adminUserId: session.session.adminUserId,
          action: "REFUND_APPROVED",
          targetType: "Refund",
          targetId: refund.id,
          payload: { amount: refund.amount.toString(), ticketIds, orderId: order.id },
        },
      });
    }
  });

  // Send email notification
  const customerEmail = order.customer.email;
  if (customerEmail) {
    void sendRefundApprovedEmail({
      customerEmail,
      customerName: order.customer.firstName ?? customerEmail,
      venueName: order.venue.name,
      refundId: refund.id,
      amount: refund.amount.toString(),
      ticketCount: (refund.ticketIds as string[]).length,
      managerNote: body.managerNote?.trim() || null,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
