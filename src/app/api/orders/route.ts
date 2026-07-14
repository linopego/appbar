import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeTicketStatus } from "@/lib/tickets/status";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const orders = await db.order.findMany({
    where: { customerId: session.user.id },
    include: {
      venue: { select: { name: true, slug: true } },
      tickets: { select: { id: true, status: true, expiresAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const data = orders.map((order) => ({
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount.toString(),
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    venue: order.venue,
    ticketCounts: {
      active: order.tickets.filter((t) => computeTicketStatus(t) === "ACTIVE").length,
      consumed: order.tickets.filter((t) => t.status === "CONSUMED").length,
      expired: order.tickets.filter((t) => computeTicketStatus(t) === "EXPIRED").length,
      refunded: order.tickets.filter((t) => t.status === "REFUNDED").length,
      total: order.tickets.length,
    },
  }));

  return NextResponse.json({ ok: true, data });
}
