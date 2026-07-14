import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { SuperAdminOperatorToggleButton } from "./operator-toggle-button";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operatori — Super Admin" };

const PAGE_SIZE = 25;

const ROLE_LABELS: Record<string, string> = {
  BARISTA: "Barista",
  CASSIERE: "Cassiere",
  MANAGER: "Manager",
};

const ROLE_COLORS: Record<string, string> = {
  BARISTA: "bg-zinc-800 text-zinc-300",
  CASSIERE: "bg-blue-900/50 text-blue-400",
  MANAGER: "bg-purple-900/50 text-purple-400",
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

export default async function SuperAdminOperatoriPage({
  searchParams,
}: {
  searchParams: Promise<{
    venueId?: string;
    role?: string;
    active?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const sp = await searchParams;
  const venueId = sp.venueId || undefined;
  const role = sp.role || undefined;
  const activeFilter =
    sp.active === "true" ? true : sp.active === "false" ? false : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const where: Prisma.OperatorWhereInput = {
    ...(venueId ? { venueId } : {}),
    ...(role ? { role: role as never } : {}),
    ...(activeFilter !== undefined ? { active: activeFilter } : {}),
  };

  const [operators, total, venues] = await Promise.all([
    db.operator.findMany({
      where,
      include: { venue: { select: { name: true } } },
      orderBy: [{ venue: { name: "asc" } }, { role: "asc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.operator.count({ where }),
    db.venue.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function qs(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      venueId: sp.venueId,
      role: sp.role,
      active: sp.active,
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
            <Link
              href="/superadmin"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← Super Admin
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Operatori</h1>
          </div>
          <Link
            href="/superadmin/operatori/nuovo"
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
          >
            + Nuovo operatore
          </Link>
        </div>

        {/* Filters */}
        <form method="GET" className="flex flex-wrap gap-3 items-end">
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
            <label className="block text-xs text-zinc-400">Ruolo</label>
            <select
              name="role"
              defaultValue={sp.role ?? ""}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">Tutti</option>
              <option value="BARISTA">Barista</option>
              <option value="CASSIERE">Cassiere</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Stato</label>
            <select
              name="active"
              defaultValue={sp.active ?? ""}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">Tutti</option>
              <option value="true">Attivi</option>
              <option value="false">Inattivi</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
            >
              Filtra
            </button>
            <Link
              href="/superadmin/operatori"
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
            >
              Reset
            </Link>
          </div>
        </form>

        <p className="text-sm text-zinc-400">{total} operatori trovati</p>

        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Venue</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Ruolo</th>
                <th className="text-left px-4 py-3">Stato</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">
                  Ultimo accesso
                </th>
                <th className="text-right px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <tr
                  key={op.id}
                  className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/20 ${
                    !op.active ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-100">{op.name}</div>
                    {op.email && (
                      <div className="text-xs text-zinc-400">{op.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">
                    {op.venue.name}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        ROLE_COLORS[op.role] ?? "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {ROLE_LABELS[op.role] ?? op.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        op.active
                          ? "bg-green-900/50 text-green-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {op.active ? "Attivo" : "Inattivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                    {formatDT(op.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/superadmin/operatori/${op.id}/modifica`}
                        className="text-xs px-3 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors"
                      >
                        Modifica
                      </Link>
                      <SuperAdminOperatorToggleButton
                        operatorId={op.id}
                        active={op.active}
                        name={op.name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {operators.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    Nessun operatore trovato.
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
                  href={`/superadmin/operatori${qs({ page: String(page - 1) })}`}
                  className="px-3 py-1 rounded-lg border border-zinc-700 hover:border-zinc-500"
                >
                  ←
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/superadmin/operatori${qs({ page: String(page + 1) })}`}
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
