import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sistema — Super Admin" };

function formatDT(d: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export default async function SuperAdminSistemaPage() {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const since24h = new Date(Date.now() - 86400000);

  const [
    orderCount,
    ticketCount,
    refundCount,
    customerCount,
    auditLogCount,
    stripeEvents,
    emailGroups,
  ] = await Promise.all([
    db.order.count(),
    db.ticket.count(),
    db.refund.count(),
    db.customer.count(),
    db.adminAuditLog.count(),
    db.stripeEvent.findMany({
      take: 10,
      orderBy: { processedAt: "desc" },
    }),
    db.emailLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since24h } },
      _count: { id: true },
    }),
  ]);

  const emailByStatus = Object.fromEntries(
    emailGroups.map((g) => [g.status, g._count.id])
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link
            href="/superadmin"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Super Admin
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Sistema</h1>
        </div>

        {/* DB Counts */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-300">
            Database — conteggi globali
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Ordini", value: orderCount },
              { label: "Ticket", value: ticketCount },
              { label: "Rimborsi", value: refundCount },
              { label: "Clienti", value: customerCount },
              { label: "Audit log", value: auditLogCount },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center space-y-1"
              >
                <p className="text-2xl font-bold tabular-nums text-zinc-100">
                  {item.value.toLocaleString("it-IT")}
                </p>
                <p className="text-xs text-zinc-400">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stripe Events */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-300">
            Ultimi eventi Stripe
          </h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">ID</th>
                  <th className="text-left px-4 py-3">Processato il</th>
                </tr>
              </thead>
              <tbody>
                {stripeEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-zinc-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                      {ev.type}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500 hidden sm:table-cell">
                      {ev.id.slice(0, 20)}…
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {formatDT(ev.processedAt)}
                    </td>
                  </tr>
                ))}
                {stripeEvents.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      Nessun evento Stripe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Email Log */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-300">
            Email — ultime 24 ore
          </h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            {emailGroups.length === 0 ? (
              <p className="text-sm text-zinc-500">Nessuna email nelle ultime 24 ore.</p>
            ) : (
              <div className="flex flex-wrap gap-6">
                {emailGroups.map((g) => (
                  <div key={g.status} className="space-y-1">
                    <p className="text-2xl font-bold tabular-nums text-zinc-100">
                      {g._count.id}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {g.status === "SENT"
                        ? "Inviate"
                        : g.status === "FAILED"
                        ? "Fallite"
                        : g.status === "BOUNCED"
                        ? "Bounced"
                        : g.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-xs text-zinc-600">
              Inviate: {emailByStatus["SENT"] ?? 0} · Fallite:{" "}
              {emailByStatus["FAILED"] ?? 0} · Bounced:{" "}
              {emailByStatus["BOUNCED"] ?? 0}
            </div>
          </div>
        </section>

        {/* Rate Limiting */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-300">
            Rate Limiting
          </h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">
              Upstash Ratelimit — configura{" "}
              <code className="font-mono text-xs bg-zinc-800 px-1 py-0.5 rounded">
                UPSTASH_REDIS_REST_URL
              </code>{" "}
              per metriche live.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
