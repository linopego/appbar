import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import { RefundStatusBadge } from "@/components/shared/refund-status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard Admin" };

function startOfDay(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function formatDateTime(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function KpiCard({ label, value, sub, href, alert }: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <div className={`rounded-xl border p-5 space-y-1 h-full ${alert ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white"}`}>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${alert ? "text-red-700" : "text-zinc-900"}`}>{value}</p>
      {sub && <p className="text-sm text-zinc-500">{sub}</p>}
    </div>
  );
  if (href) return <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link>;
  return inner;
}

export default async function AdminDashboardPage() {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const now = new Date();
  const today = startOfDay(now);
  const monthStart = startOfMonth(now);

  const [
    ordersToday,
    monthAggregate,
    ticketsActive,
    ticketsConsumedToday,
    refundsPending,
    recentOrders,
  ] = await Promise.all([
    db.order.count({
      where: {
        venueId: session.venueId,
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
        paidAt: { gte: today },
      },
    }),
    db.order.aggregate({
      where: {
        venueId: session.venueId,
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
        paidAt: { gte: monthStart },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    db.ticket.count({
      where: {
        venueId: session.venueId,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
    }),
    db.ticket.count({
      where: {
        venueId: session.venueId,
        status: "CONSUMED",
        consumedAt: { gte: today },
      },
    }),
    db.refund.count({
      where: { order: { venueId: session.venueId }, status: "PENDING" },
    }),
    db.order.findMany({
      where: {
        venueId: session.venueId,
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
      take: 10,
      orderBy: { paidAt: "desc" },
      include: {
        customer: { select: { email: true, firstName: true, lastName: true } },
        _count: { select: { tickets: true } },
      },
    }),
  ]);

  const monthCount = monthAggregate._count.id;
  const monthTotal = monthAggregate._sum.totalAmount?.toString() ?? "0";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Ordini oggi" value={ordersToday} />
        <KpiCard
          label="Incassi mese"
          value={formatEur(monthTotal)}
          sub={`${monthCount} ordini`}
        />
        <KpiCard label="Ticket attivi" value={ticketsActive} />
        <KpiCard label="Consegnati oggi" value={ticketsConsumedToday} />
        <KpiCard
          label="Rimborsi in attesa"
          value={refundsPending}
          href={refundsPending > 0 ? "/admin/rimborsi?status=PENDING" : undefined}
          alert={refundsPending > 0}
        />
      </div>

      {/* Recent orders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Ultimi ordini</h2>
          <Link href="/admin/ordini" className="text-sm text-zinc-500 hover:text-zinc-900 underline">
            Vedi tutti →
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Ticket</th>
                <th className="text-right px-4 py-3">Totale</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Stato</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    <Link href={`/admin/ordini/${order.id}`} className="hover:underline">
                      {formatDateTime(order.paidAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 max-w-[160px] truncate">
                    {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.email}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500 hidden sm:table-cell">{order._count.tickets}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatEur(order.totalAmount.toString())}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <RefundStatusBadge status={order.status as never} />
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                    Nessun ordine ancora
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Azioni rapide</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/admin/listino", label: "Gestisci listino" },
            { href: "/admin/operatori", label: "Gestisci operatori" },
            { href: "/admin/statistiche", label: "Statistiche avanzate" },
            { href: "/admin/rimborsi", label: "Gestisci rimborsi" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 transition-colors text-center"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
