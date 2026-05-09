import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ordini — Super Admin" };

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<string, string> = {
  PAID: "Pagato",
  REFUNDED: "Rimborsato",
  PARTIALLY_REFUNDED: "Parz. rimborsato",
  FAILED: "Fallito",
  PENDING: "Pendente",
};

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-green-900/50 text-green-400",
  REFUNDED: "bg-zinc-800 text-zinc-400",
  PARTIALLY_REFUNDED: "bg-blue-900/50 text-blue-400",
  FAILED: "bg-red-900/50 text-red-400",
  PENDING: "bg-yellow-900/50 text-yellow-400",
};

function formatDateTime(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function SuperAdminOrdiniPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    venueId?: string;
    from?: string;
    to?: string;
    email?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const sp = await searchParams;
  const status = sp.status && sp.status !== "all" ? sp.status : undefined;
  const venueId = sp.venueId || undefined;
  const from = sp.from ? new Date(sp.from + "T00:00:00") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : undefined;
  const email = sp.email?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as never } : {}),
    ...(venueId ? { venueId } : {}),
    ...(from || to
      ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
    ...(email
      ? { customer: { email: { contains: email, mode: "insensitive" as never } } }
      : {}),
  };

  const [orders, total, venues] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        customer: { select: { email: true, firstName: true, lastName: true } },
        venue: { select: { name: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
    db.venue.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function qs(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      status: sp.status,
      venueId: sp.venueId,
      from: sp.from,
      to: sp.to,
      email: sp.email,
      page: sp.page,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString() ? `?${params.toString()}` : "";
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/superadmin" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← Super Admin
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Ordini</h1>
          </div>
          {/* TODO: export */}
        </div>

        {/* Filters */}
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Stato</label>
            <select
              name="status"
              defaultValue={sp.status ?? "all"}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="all">Tutti</option>
              <option value="PAID">Pagato</option>
              <option value="PARTIALLY_REFUNDED">Parz. rimborsato</option>
              <option value="REFUNDED">Rimborsato</option>
              <option value="FAILED">Fallito</option>
              <option value="PENDING">Pendente</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Venue</label>
            <select
              name="venueId"
              defaultValue={sp.venueId ?? ""}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">Tutti i venue</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Da</label>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">A</label>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Email</label>
            <input
              type="text"
              name="email"
              defaultValue={sp.email ?? ""}
              placeholder="cerca@email.com"
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 w-48"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
          >
            Filtra
          </button>
          <Link
            href="/superadmin/ordini"
            className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
          >
            Reset
          </Link>
        </form>

        <p className="text-sm text-zinc-400">{total} ordini trovati</p>

        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Cliente</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Venue</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Ticket</th>
                <th className="text-right px-4 py-3">Totale</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Stato</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/superadmin/ordini/${order.id}`}
                      className="text-zinc-300 hover:text-zinc-50 underline"
                    >
                      {formatDateTime(order.paidAt ?? order.createdAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[160px] truncate text-zinc-300 hidden sm:table-cell">
                    {[order.customer.firstName, order.customer.lastName]
                      .filter(Boolean)
                      .join(" ") || order.customer.email}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden lg:table-cell">
                    {order.venue.name}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 hidden md:table-cell">
                    {order._count.tickets}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-100">
                    {formatEur(order.totalAmount.toString())}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_BADGE[order.status] ?? "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                    Nessun ordine trovato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center text-sm text-zinc-400">
            <span>
              Pagina {page} di {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/superadmin/ordini${qs({ page: String(page - 1) })}`}
                  className="px-3 py-1 rounded-lg border border-zinc-700 hover:border-zinc-500"
                >
                  ←
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/superadmin/ordini${qs({ page: String(page + 1) })}`}
                  className="px-3 py-1 rounded-lg border border-zinc-700 hover:border-zinc-500"
                >
                  →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
