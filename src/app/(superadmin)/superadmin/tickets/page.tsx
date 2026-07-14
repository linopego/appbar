import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket — Super Admin" };

const PAGE_SIZE = 25;

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

const ALL_STATUSES = ["ACTIVE", "CONSUMED", "EXPIRED", "REFUNDED"];

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

export default async function SuperAdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    venueId?: string;
    from?: string;
    to?: string;
    email?: string;
    qrToken?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const sp = await searchParams;

  const statusRaw = sp.status
    ? Array.isArray(sp.status)
      ? sp.status
      : [sp.status]
    : [];
  const statuses = statusRaw.filter((s) => ALL_STATUSES.includes(s));
  const venueId = sp.venueId || undefined;
  const from = sp.from ? new Date(sp.from + "T00:00:00") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : undefined;
  const email = sp.email?.trim() || undefined;
  const qrToken = sp.qrToken?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const where: Prisma.TicketWhereInput = {
    ...(statuses.length > 0 ? { status: { in: statuses as never } } : {}),
    ...(venueId ? { venueId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(email
      ? {
          customer: {
            email: { contains: email, mode: "insensitive" as never },
          },
        }
      : {}),
    ...(qrToken ? { qrToken: { contains: qrToken } } : {}),
  };

  const [tickets, total, venues] = await Promise.all([
    db.ticket.findMany({
      where,
      include: {
        customer: { select: { email: true } },
        venue: { select: { name: true } },
        priceTier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.ticket.count({ where }),
    db.venue.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    // preserve multi-value status
    const newStatuses =
      overrides.__statuses !== undefined
        ? overrides.__statuses.split(",").filter(Boolean)
        : statuses;
    for (const s of newStatuses) params.append("status", s);

    const merged = {
      venueId: sp.venueId,
      from: sp.from,
      to: sp.to,
      email: sp.email,
      qrToken: sp.qrToken,
      page: sp.page,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (k === "__statuses") continue;
      if (v) params.set(k, v);
    }
    return params.toString() ? `?${params.toString()}` : "";
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link
            href="/superadmin"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Super Admin
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Ticket</h1>
        </div>

        {/* Filters */}
        <form method="GET" className="flex flex-wrap gap-3 items-start">
          {/* Status checkboxes */}
          <div className="space-y-1">
            <p className="text-xs text-zinc-400">Stato</p>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="status"
                    value={s}
                    defaultChecked={statuses.includes(s)}
                    className="accent-zinc-400"
                  />
                  <span className="text-xs text-zinc-300">
                    {TICKET_STATUS_LABELS[s]}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Venue</label>
            <select
              name="venueId"
              defaultValue={sp.venueId ?? ""}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">Tutti</option>
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
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 w-44"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">QR token</label>
            <input
              type="text"
              name="qrToken"
              defaultValue={sp.qrToken ?? ""}
              placeholder="parziale…"
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-500 w-44"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
            >
              Filtra
            </button>
            <Link
              href="/superadmin/tickets"
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
            >
              Reset
            </Link>
          </div>
        </form>

        <p className="text-sm text-zinc-400">{total} ticket trovati</p>

        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">QR Token</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Venue</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Tier</th>
                <th className="text-left px-4 py-3">Stato</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">Creato il</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">
                  Consegnato il
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/superadmin/tickets/${t.id}`}
                      className="font-mono text-xs text-zinc-300 hover:text-zinc-50 underline"
                    >
                      {t.qrToken.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden lg:table-cell">
                    {t.venue.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs hidden sm:table-cell truncate max-w-[160px]">
                    {t.customer.email}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 hidden md:table-cell">
                    {t.priceTier.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        TICKET_STATUS_COLORS[t.status] ??
                        "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {TICKET_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden xl:table-cell">
                    {formatDT(t.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden xl:table-cell">
                    {formatDT(t.consumedAt)}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                    Nessun ticket trovato
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
                  href={`/superadmin/tickets${buildUrl({ page: String(page - 1) })}`}
                  className="px-3 py-1 rounded-lg border border-zinc-700 hover:border-zinc-500"
                >
                  ←
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/superadmin/tickets${buildUrl({ page: String(page + 1) })}`}
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
