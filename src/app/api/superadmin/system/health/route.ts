import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const [orderCount, ticketCount, refundCount, customerCount, auditLogCount, recentStripeEvents, emailStats] =
    await Promise.all([
      db.order.count(),
      db.ticket.count(),
      db.refund.count(),
      db.customer.count(),
      db.adminAuditLog.count(),
      db.stripeEvent.findMany({ take: 10, orderBy: { processedAt: "desc" } }),
      db.emailLog.groupBy({
        by: ["status"],
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
        _count: { id: true },
      }),
    ]);

  return NextResponse.json({
    ok: true,
    data: {
      counts: {
        orders: orderCount,
        tickets: ticketCount,
        refunds: refundCount,
        customers: customerCount,
        auditLogs: auditLogCount,
      },
      stripeEvents: recentStripeEvents,
      emailStats,
    },
  });
}
