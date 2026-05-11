import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ordini — Admin" };

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<string, string> = {
  PAID: "Pagato",
  REFUNDED: "Rimborsato",
  PARTIALLY_REFUNDED: "Parz. rimborsato",
  FAILED: "Fallito",
  PENDING: "Pendente",
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

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  REFUNDED: "bg-zinc-100 text-zinc-600",
  PARTIALLY_REFUNDED: "bg-blue-100 text-blue-800",
  FAILED: "bg-red-100 text-red-700",
  PENDING: "bg-yellow-100 text-yellow-800",
};

export default async function AdminOrdiniPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; email?: string; page?: string }>;
}) {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const sp = await searchParams;
  const status = sp.status && sp.status !== "all" ? sp.status : undefined;
  const from = sp.from ? new Date(sp.from + "T00:00:00") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : undefined;
  const email = sp.email?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const where = {
    venueId: session.venueId,
    ...(status ? { status: status as never } : {}),
    ...(from || to ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(email ? { customer: { email: { contains: email, mode: "insensitive" as never } } } : {}),
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        customer: { select: { email: true, firstName: true, lastName: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build query string helper
  function qs(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { status: sp.status, from: sp.from, to: sp.to, email: sp.email, page: sp.page, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString() ? `?${params.toString()}` : "";
  }

  // CSV export URL
  const exportParams = new URLSearchParams();
  if (status) exportParams.set("status", status);
  if (sp.from) exportParams.set("from", sp.from);
  if (sp.to) exportParams.set("to", sp.to);
  if (email) exportParams.set("email", email);
  const exportUrl = `/api/admin/orders/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Ordini</h1>
        <a
          href={exportUrl}
          className="text-sm px-4 py-2 rounded-lg border border-zinc-300 hover:border-zinc-500 text-zinc-700 font-medium transition-colors"
        >
          Esporta CSV
        </a>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="block text-xs text-zinc-500">Stato</label>
          <select name="status" defaultValue={sp.status ?? "all"} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500">
            <option value="all">Tutti</option>
            <option value="PAID">Pagato</option>
            <option value="PARTIALLY_REFUNDED">Parz. rimborsato</option>
            <option value="REFUNDED">Rimborsato</option>
            <option value="FAILED">Fallito</option>
            <option value="PENDING">Pendente</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-500">Da</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-500">A</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-500">Email cliente</label>
          <input type="text" name="email" defaultValue={sp.email ?? ""} placeholder="cerca@email.com" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 w-52" />
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors">
          Filtra
        </button>
        <Link href="/admin/ordini" className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 text-sm hover:bg-zinc-50 transition-colors">
          Reset
        </Link>
      </form>

      <p className="text-sm text-zinc-500">{total} ordini trovati</p>

      {/* Table */}
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
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/admin/ordini/${order.id}`} className="hover:underline text-zinc-700">
                    {formatDateTime(order.paidAt)}
                  </Link>
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate text-zinc-700">
                  {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.email}
                </td>
                <td className="px-4 py-3 text-right text-zinc-500 hidden sm:table-cell">{order._count.tickets}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{formatEur(order.totalAmount.toString())}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">Nessun ordine trovato</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-sm text-zinc-500">
          <span>Pagina {page} di {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/ordini${qs({ page: String(page - 1) })}`} className="px-3 py-1 rounded-lg border border-zinc-200 hover:border-zinc-400">←</Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/ordini${qs({ page: String(page + 1) })}`} className="px-3 py-1 rounded-lg border border-zinc-200 hover:border-zinc-400">→</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
