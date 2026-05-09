import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Super Admin" };

export default async function SuperAdminDashboardPage() {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const [
    venueCount,
    activeVenueCount,
    orderCount,
    ticketCount,
    revenueAgg,
    pendingRefundCount,
    operatorCount,
    adminUserCount,
    recentOrders,
  ] = await Promise.all([
    db.venue.count(),
    db.venue.count({ where: { active: true } }),
    db.order.count({ where: { status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } } }),
    db.ticket.count(),
    db.order.aggregate({
      where: { status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } },
      _sum: { totalAmount: true },
    }),
    db.refund.count({ where: { status: "PENDING" } }),
    db.operator.count({ where: { active: true } }),
    db.adminUser.count({ where: { active: true } }),
    db.order.findMany({
      where: { status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: {
        venue: { select: { name: true } },
        customer: { select: { email: true, firstName: true } },
      },
    }),
  ]);

  const totalRevenue = revenueAgg._sum.totalAmount?.toFixed(2) ?? "0.00";

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">Panoramica cross-venue</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Venue attivi" value={`${activeVenueCount} / ${venueCount}`} />
        <KpiCard label="Ordini totali" value={orderCount.toLocaleString("it-IT")} />
        <KpiCard label="Ticket emessi" value={ticketCount.toLocaleString("it-IT")} />
        <KpiCard label="Fatturato" value={`€${totalRevenue}`} highlight />
        <KpiCard label="Rimborsi pendenti" value={pendingRefundCount.toString()} warn={pendingRefundCount > 0} />
        <KpiCard label="Operatori attivi" value={operatorCount.toString()} />
        <KpiCard label="Admin attivi" value={adminUserCount.toString()} />
      </div>

      {/* Recent orders */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Ultimi ordini</h2>
        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2">Venue</th>
                <th className="text-left px-4 py-2 hidden sm:table-cell">Cliente</th>
                <th className="text-right px-4 py-2">Totale</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Data</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-2 text-zinc-300">{o.venue.name}</td>
                  <td className="px-4 py-2 text-zinc-400 hidden sm:table-cell text-xs">
                    {o.customer.firstName ?? o.customer.email}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-200">
                    €{o.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-zinc-500 text-xs hidden md:table-cell">
                    {o.paidAt
                      ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(o.paidAt)
                      : "—"}
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    Nessun ordine ancora.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-1">
      <div className="text-xs text-zinc-400">{label}</div>
      <div
        className={`text-2xl font-bold ${
          warn ? "text-amber-400" : highlight ? "text-green-400" : "text-zinc-50"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
