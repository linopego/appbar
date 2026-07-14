import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAdminOrManagerSession } from "@/lib/auth/admin-or-manager";
import { db } from "@/lib/db";
import { RefundStatusBadge } from "@/components/shared/refund-status-badge";
import { RefundTimeline } from "@/components/shared/refund-timeline";
import { formatEur } from "@/lib/utils/money";
import { RefundActionForm } from "./refund-action-form";

export const dynamic = "force-dynamic";

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export default async function AdminRimborsoDettaglioPage({
  params,
}: {
  params: Promise<{ refundId: string }>;
}) {
  const session = await getAdminOrManagerSession();
  if (!session) redirect("/");

  const { refundId } = await params;

  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: {
      order: {
        include: {
          customer: { select: { email: true, firstName: true, lastName: true } },
          venue: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!refund) notFound();

  if (session.kind === "manager" && refund.order.venueId !== session.session.venueId) {
    redirect("/admin/rimborsi");
  }

  const ticketIds = refund.ticketIds as string[];
  const tickets = await db.ticket.findMany({
    where: { id: { in: ticketIds } },
    include: { priceTier: { select: { name: true, price: true } } },
  });

  const customer = refund.order.customer;
  const customerLabel =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;

  return (
    <main className="min-h-dvh bg-zinc-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <Link href="/admin/rimborsi" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Rimborsi
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">Rimborso</h1>
            <RefundStatusBadge status={refund.status} />
          </div>
        </div>

        {/* Info cliente + ordine */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 divide-y divide-zinc-100">
          <div className="pb-3 space-y-1">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Cliente</p>
            <p className="font-medium text-zinc-900">{customerLabel}</p>
            <p className="text-sm text-zinc-500">{customer.email}</p>
          </div>
          <div className="pt-3 pb-3 space-y-1">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Venue</p>
            <p className="font-medium text-zinc-900">{refund.order.venue.name}</p>
          </div>
          <div className="pt-3 space-y-2">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Ordine</p>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">ID</span>
              <span className="font-mono text-zinc-700 text-xs">{refund.orderId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Richiesta il</span>
              <span className="text-zinc-700">{formatDate(refund.requestedAt)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Importo rimborso</span>
              <span className="text-zinc-900">{formatEur(refund.amount.toString())}</span>
            </div>
          </div>
        </div>

        {/* Motivazione cliente */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Motivazione cliente</p>
          <p className="text-sm text-zinc-700">{refund.reason || refund.customerNote || "—"}</p>
        </div>

        {/* Ticket list */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700">Ticket da rimborsare ({ticketIds.length})</h2>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden bg-white">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-zinc-700">{ticket.priceTier.name}</span>
                <span className="text-sm text-zinc-500">{formatEur(ticket.priceTier.price.toString())}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action form (only for PENDING) */}
        {refund.status === "PENDING" && (
          <RefundActionForm
            refundId={refund.id}
            amount={formatEur(refund.amount.toString())}
            ticketCount={ticketIds.length}
          />
        )}

        {/* Timeline (for terminal states) */}
        {refund.status !== "PENDING" && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-700">Cronologia</h2>
            <RefundTimeline
              requestedAt={refund.requestedAt}
              status={refund.status}
              processedAt={refund.processedAt}
              managerNote={refund.managerNote}
            />
            {refund.stripeRefundId && (
              <div className="flex justify-between text-xs text-zinc-500 pt-2">
                <span>Stripe Refund ID</span>
                <span className="font-mono">{refund.stripeRefundId}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
