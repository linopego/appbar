import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import { computeTicketStatus } from "@/lib/tickets/status";
import { ManualRefundButton } from "./manual-refund-button";

export const dynamic = "force-dynamic";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PAID: "Pagato",
  REFUNDED: "Rimborsato",
  PARTIALLY_REFUNDED: "Parzialmente rimborsato",
  FAILED: "Fallito",
  PENDING: "Pendente",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Attivo",
  CONSUMED: "Consegnato",
  EXPIRED: "Scaduto",
  REFUNDED: "Rimborsato",
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-900/50 text-green-400",
  CONSUMED: "bg-zinc-800 text-zinc-400",
  EXPIRED: "bg-yellow-900/50 text-yellow-400",
  REFUNDED: "bg-red-900/50 text-red-400",
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Approvato",
  COMPLETED: "Completato",
  REJECTED: "Rifiutato",
};

const REFUND_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900/50 text-yellow-400",
  APPROVED: "bg-blue-900/50 text-blue-400",
  COMPLETED: "bg-green-900/50 text-green-400",
  REJECTED: "bg-red-900/50 text-red-400",
};

function formatDT(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function SuperAdminOrdineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: true,
      venue: { select: { id: true, name: true, slug: true } },
      items: {
        include: { priceTier: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      tickets: {
        include: {
          priceTier: { select: { name: true, price: true } },
          operator: { select: { name: true } },
        },
        orderBy: [{ priceTier: { sortOrder: "asc" } }, { createdAt: "asc" }],
      },
      refunds: { orderBy: { requestedAt: "desc" } },
    },
  });

  if (!order) notFound();

  const customerName =
    [order.customer.firstName, order.customer.lastName]
      .filter(Boolean)
      .join(" ") || order.customer.email;

  const hasActiveTickets =
    (order.status === "PAID" || order.status === "PARTIALLY_REFUNDED") &&
    order.tickets.some((t) => computeTicketStatus(t) === "ACTIVE");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-1">
          <Link
            href="/superadmin/ordini"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Ordini
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">
              Ordine #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300">
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
        </div>

        {/* Order info */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">
              Cliente
            </p>
            <p className="font-medium text-zinc-100">{customerName}</p>
            <p className="text-sm text-zinc-400">{order.customer.email}</p>
          </div>
          <div className="border-t border-zinc-800 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Venue</span>
              <Link
                href={`/superadmin/venues/${order.venue.id}`}
                className="text-zinc-300 hover:text-zinc-50 underline"
              >
                {order.venue.name}
              </Link>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Data ordine</span>
              <span className="text-zinc-200">{formatDT(order.createdAt)}</span>
            </div>
            {order.paidAt && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Pagato il</span>
                <span className="text-zinc-200">{formatDT(order.paidAt)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-zinc-200">Totale</span>
              <span className="text-zinc-100">
                {formatEur(order.totalAmount.toString())}
              </span>
            </div>
            {order.stripePaymentId && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Stripe Payment</span>
                <a
                  href={`https://dashboard.stripe.com/payments/${order.stripePaymentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-blue-400 hover:underline"
                >
                  {order.stripePaymentId.slice(0, 20)}…
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <h2 className="font-semibold text-zinc-200">Articoli acquistati</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between px-4 py-3 text-sm border-b border-zinc-800/50 last:border-0"
              >
                <span className="text-zinc-300">
                  {item.tierName} × {item.quantity}
                </span>
                <span className="text-zinc-400">
                  {formatEur(
                    (Number(item.unitPrice) * item.quantity).toFixed(2)
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tickets */}
        <div className="space-y-2">
          <h2 className="font-semibold text-zinc-200">
            Ticket ({order.tickets.length})
          </h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
            {order.tickets.map((t) => {
              const eff = computeTicketStatus(t);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0"
                >
                  <span
                    className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      TICKET_STATUS_COLORS[eff] ?? "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {TICKET_STATUS_LABELS[eff] ?? eff}
                  </span>
                  <Link
                    href={`/superadmin/tickets/${t.id}`}
                    className="flex-1 text-sm text-zinc-300 hover:text-zinc-50 underline"
                  >
                    {t.priceTier.name}
                  </Link>
                  {t.consumedAt && (
                    <span className="text-xs text-zinc-500">
                      {formatDT(t.consumedAt)}
                      {t.operator ? ` · ${t.operator.name}` : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Refunds */}
        {order.refunds.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-zinc-200">Rimborsi</h2>
            <div className="space-y-2">
              {order.refunds.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-zinc-200">
                      {formatEur(r.amount.toString())} ·{" "}
                      {(r.ticketIds as string[]).length} ticket
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDT(r.requestedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        REFUND_STATUS_COLORS[r.status] ??
                        "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {REFUND_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    <Link
                      href={`/admin/rimborsi/${r.id}`}
                      className="text-xs text-zinc-400 hover:text-zinc-50 underline"
                    >
                      Vedi →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual refund */}
        {hasActiveTickets && (
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <h2 className="font-semibold text-zinc-200">Rimborso manuale</h2>
            <p className="text-sm text-zinc-400">
              Rimborsa manualmente tutti i ticket attivi di questo ordine.
            </p>
            <ManualRefundButton orderId={id} />
          </div>
        )}
      </div>
    </main>
  );
}
