import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { formatEur } from "@/lib/utils/money";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Super Admin" };

export default async function SuperAdminDashboardPage() {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const scope = orgScopeWhere(session);

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
    db.venue.count({ where: scope.venue }),
    db.venue.count({ where: { active: true, ...scope.venue } }),
    db.order.count({ where: { status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] }, ...scope.byVenue } }),
    db.ticket.count({ where: scope.byVenue }),
    db.order.aggregate({
      where: { status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] }, ...scope.byVenue },
      _sum: { totalAmount: true },
    }),
    db.refund.count({ where: { status: "PENDING", ...scope.byOrder } }),
    db.operator.count({ where: { active: true, ...scope.byVenue } }),
    db.adminUser.count({ where: { active: true, ...scope.adminUser } }),
    db.order.findMany({
      where: { status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] }, ...scope.byVenue },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: {
        venue: { select: { name: true } },
        customer: { select: { email: true, firstName: true } },
      },
    }),
  ]);

  const totalRevenue = revenueAgg._sum.totalAmount?.toFixed(2) ?? "0.00";

  // Card riassuntiva piattaforma: solo per gli admin PLATFORM
  let platformSummary: { activeOrgs: number; gmv30d: string; fees30d: string } | null = null;
  if (session.role === "PLATFORM") {
    // Server component force-dynamic: leggere l'ora corrente a ogni request è voluto.
    // eslint-disable-next-line react-hooks/purity
    const since30d = new Date(Date.now() - 30 * 86400000);
    const [activeOrgs, agg30] = await Promise.all([
      db.organization.count({ where: { active: true } }),
      db.order.aggregate({
        where: { status: "PAID", createdAt: { gte: since30d } },
        _sum: { totalAmount: true, platformFeeAmount: true },
      }),
    ]);
    platformSummary = {
      activeOrgs,
      gmv30d: (agg30._sum.totalAmount ?? 0).toString(),
      fees30d: (agg30._sum.platformFeeAmount ?? 0).toString(),
    };
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">Panoramica cross-venue</p>
      </div>

      {platformSummary && (
        <Link
          href="/superadmin/organizations"
          className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-600 transition-colors"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              Piattaforma
            </h2>
            <span className="text-xs text-zinc-500">Organizzazioni →</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div>
              <p className="text-xs text-zinc-500">Organizzazioni attive</p>
              <p className="text-xl font-semibold mt-0.5 tabular-nums">
                {platformSummary.activeOrgs}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">GMV 30gg</p>
              <p className="text-xl font-semibold mt-0.5 tabular-nums">
                {formatEur(platformSummary.gmv30d)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Fee 30gg</p>
              <p className="text-xl font-semibold mt-0.5 tabular-nums">
                {formatEur(platformSummary.fees30d)}
              </p>
            </div>
          </div>
        </Link>
      )}

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
