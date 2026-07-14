import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { computeTicketStatus } from "@/lib/tickets/status";
import { formatEur } from "@/lib/utils/money";
import { RefundStatusBadge } from "@/components/shared/refund-status-badge";
import { InvalidateTicketsForm } from "./invalidate-tickets-form";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
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
  ACTIVE: "bg-green-100 text-green-800",
  CONSUMED: "bg-zinc-100 text-zinc-600",
  EXPIRED: "bg-yellow-100 text-yellow-800",
  REFUNDED: "bg-red-100 text-red-700",
};

function formatDT(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export default async function AdminOrdineDettaglioPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const { orderId } = await params;

  const order = await db.order.findUnique({
    where: { id: orderId, venueId: session.venueId },
    include: {
      customer: true,
      items: { include: { priceTier: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      tickets: {
        include: { priceTier: { select: { name: true, price: true } }, operator: { select: { name: true } } },
        orderBy: [{ priceTier: { sortOrder: "asc" } }, { createdAt: "asc" }],
      },
      refunds: { orderBy: { requestedAt: "desc" } },
    },
  });

  if (!order) notFound();

  const activeTickets = order.tickets
    .filter((t) => computeTicketStatus(t) === "ACTIVE")
    .map((t) => ({
      id: t.id,
      tierName: t.priceTier.name,
      price: formatEur(t.priceTier.price.toString()),
    }));

  const customerName = [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.email;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <Link href="/admin/ordini" className="text-sm text-zinc-500 hover:text-zinc-800">← Ordini</Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">Ordine #{order.id.slice(0, 8).toUpperCase()}</h1>
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </div>

      {/* Order info */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 divide-y divide-zinc-100">
        <div className="pb-3 space-y-1">
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Cliente</p>
          <p className="font-medium text-zinc-900">{customerName}</p>
          <p className="text-sm text-zinc-500">{order.customer.email}</p>
        </div>
        <div className="pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Data ordine</span>
            <span>{formatDT(order.createdAt)}</span>
          </div>
          {order.paidAt && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Pagato il</span>
              <span>{formatDT(order.paidAt)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold">
            <span>Totale</span>
            <span>{formatEur(order.totalAmount.toString())}</span>
          </div>
          {order.stripePaymentId && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Stripe Payment</span>
              <a
                href={`https://dashboard.stripe.com/test/payments/${order.stripePaymentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-blue-600 hover:underline"
              >
                {order.stripePaymentId.slice(0, 20)}…
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        <h2 className="font-semibold text-zinc-900">Articoli acquistati</h2>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden bg-white">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between px-4 py-3 text-sm">
              <span className="text-zinc-700">{item.tierName} × {item.quantity}</span>
              <span className="text-zinc-500">{formatEur((Number(item.unitPrice) * item.quantity).toFixed(2))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* All tickets */}
      <div className="space-y-2">
        <h2 className="font-semibold text-zinc-900">Ticket ({order.tickets.length})</h2>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden bg-white">
          {order.tickets.map((t) => {
            const eff = computeTicketStatus(t);
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLORS[eff] ?? "bg-zinc-100"}`}>
                  {TICKET_STATUS_LABELS[eff] ?? eff}
                </span>
                <span className="flex-1 text-sm text-zinc-700">{t.priceTier.name}</span>
                {t.consumedAt && (
                  <span className="text-xs text-zinc-400">{formatDT(t.consumedAt)}{t.operator ? ` · ${t.operator.name}` : ""}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Refunds */}
      {order.refunds.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-zinc-900">Rimborsi</h2>
          <div className="space-y-2">
            {order.refunds.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{formatEur(r.amount.toString())} · {(r.ticketIds as string[]).length} ticket</p>
                  <p className="text-xs text-zinc-400">{formatDT(r.requestedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <RefundStatusBadge status={r.status} />
                  <Link href={`/admin/rimborsi/${r.id}`} className="text-xs text-zinc-500 hover:text-zinc-900 underline">
                    Vedi →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual ticket invalidation */}
      {activeTickets.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-zinc-200">
          <h2 className="font-semibold text-zinc-900">Invalidazione manuale</h2>
          <InvalidateTicketsForm tickets={activeTickets} />
        </div>
      )}
    </div>
  );
}
