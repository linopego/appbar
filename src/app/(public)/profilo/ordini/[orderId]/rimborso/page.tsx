import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeTicketStatus } from "@/lib/tickets/status";
import { isRefundCurrentlyBlocked, nextUnblockedTime, type RefundWindow } from "@/lib/refunds/blocked-windows";
import { RefundRequestForm } from "./refund-request-form";

export const dynamic = "force-dynamic";

export default async function RimborsoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orderId } = await params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      venue: true,
      tickets: { include: { priceTier: true } },
      refunds: { where: { status: { in: ["PENDING", "APPROVED", "COMPLETED"] } } },
    },
  });

  if (!order || order.customerId !== session.user.id) notFound();

  if (!["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) {
    redirect(`/ordine/${orderId}`);
  }

  const windows = (order.venue.refundBlockedWindows as RefundWindow[] | null) ?? [];
  const timezone = order.venue.refundBlockedTimezone;
  const blockedByTime = isRefundCurrentlyBlocked(windows, timezone);
  const nextTime = blockedByTime ? nextUnblockedTime(windows, timezone) : null;

  // Ticket IDs already in a pending/approved refund
  const inPendingRefundIds = new Set(
    order.refunds.flatMap((r) => r.ticketIds as string[])
  );

  const refundableTickets: Array<{ id: string; tierName: string; price: string; qrToken: string }> = [];
  const nonRefundableTickets: Array<{
    id: string;
    tierName: string;
    price: string;
    reason: "CONSUMED" | "EXPIRED" | "REFUNDED" | "IN_PENDING_REFUND";
  }> = [];

  for (const ticket of order.tickets) {
    const effective = computeTicketStatus(ticket);
    const price = ticket.priceTier.price.toString();
    const tierName = ticket.priceTier.name;

    if (inPendingRefundIds.has(ticket.id)) {
      nonRefundableTickets.push({ id: ticket.id, tierName, price, reason: "IN_PENDING_REFUND" });
    } else if (effective === "ACTIVE") {
      refundableTickets.push({ id: ticket.id, tierName, price, qrToken: ticket.qrToken });
    } else {
      nonRefundableTickets.push({
        id: ticket.id,
        tierName,
        price,
        reason: effective as "CONSUMED" | "EXPIRED" | "REFUNDED",
      });
    }
  }

  const eligible = !blockedByTime && refundableTickets.length > 0 && order.refunds.length === 0;

  return (
    <main className="min-h-dvh bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <Link href={`/ordine/${orderId}`} className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Torna all'ordine
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">Richiedi rimborso</h1>
          <p className="text-sm text-zinc-500">{order.venue.name}</p>
        </div>

        <RefundRequestForm
          orderId={orderId}
          eligible={eligible}
          blockedByTime={blockedByTime}
          nextUnblockedTime={nextTime?.toISOString() ?? null}
          venueTimezone={timezone}
          refundableTickets={refundableTickets}
          nonRefundableTickets={nonRefundableTickets}
        />
      </div>
    </main>
  );
}
