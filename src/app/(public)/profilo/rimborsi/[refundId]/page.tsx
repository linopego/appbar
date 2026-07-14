import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { RefundStatusBadge } from "@/components/shared/refund-status-badge";
import { RefundTimeline } from "@/components/shared/refund-timeline";
import { formatEur } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export default async function RimborsoDettaglioPage({
  params,
}: {
  params: Promise<{ refundId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { refundId } = await params;

  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: {
      order: {
        include: {
          venue: true,
          tickets: {
            where: { id: { in: [] } }, // placeholder, we'll filter below
            include: { priceTier: true },
          },
        },
      },
    },
  });

  if (!refund || refund.order.customerId !== session.user.id) notFound();

  const ticketIds = refund.ticketIds as string[];
  const tickets = await db.ticket.findMany({
    where: { id: { in: ticketIds } },
    include: { priceTier: true },
  });

  return (
    <main className="min-h-dvh bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <Link href="/profilo/rimborsi" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← I miei rimborsi
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">Rimborso</h1>
            <RefundStatusBadge status={refund.status} />
          </div>
          <p className="text-sm text-zinc-500">{refund.order.venue.name}</p>
        </div>

        {/* Info riepilogo */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Importo</span>
            <span className="font-semibold text-zinc-900">{formatEur(refund.amount.toString())}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Ticket coinvolti</span>
            <span className="font-medium">{ticketIds.length}</span>
          </div>
          {refund.stripeRefundId && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Rif. Stripe</span>
              <span className="font-mono text-xs text-zinc-500">{refund.stripeRefundId}</span>
            </div>
          )}
        </div>

        {/* Motivazione cliente */}
        {refund.reason && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">La tua motivazione</p>
            <p className="text-sm text-zinc-700">{refund.reason}</p>
          </div>
        )}

        {/* Ticket list */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-700">Ticket nella richiesta</h2>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden bg-white">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-zinc-700">{ticket.priceTier.name}</span>
                <span className="text-sm text-zinc-500">{formatEur(ticket.priceTier.price.toString())}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-700">Cronologia</h2>
          <RefundTimeline
            requestedAt={refund.requestedAt}
            status={refund.status}
            processedAt={refund.processedAt}
            managerNote={refund.managerNote}
          />
        </div>

        {/* Status-specific messages */}
        {refund.status === "PENDING" && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            La tua richiesta è in attesa di revisione. Risponderemo entro 3 giorni lavorativi.
          </div>
        )}
        {(refund.status === "APPROVED" || refund.status === "COMPLETED") && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {refund.status === "COMPLETED"
              ? "Il rimborso è stato elaborato. L'importo può richiedere 5–10 giorni lavorativi per apparire sul tuo conto."
              : "Il rimborso è stato approvato e inviato a Stripe. Riceverai il rimborso entro 5–10 giorni lavorativi."}
          </div>
        )}

        <Link
          href={`/ordine/${refund.orderId}`}
          className="block text-center text-sm text-zinc-500 hover:text-zinc-800 underline"
        >
          Vedi ordine originale
        </Link>
      </div>
    </main>
  );
}
