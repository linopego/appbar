import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { AuditLogRow } from "./audit-log-row";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Log — Super Admin" };

const PAGE_SIZE = 50;

const TARGET_TYPES = [
  "Ticket",
  "Order",
  "Operator",
  "Venue",
  "PriceTier",
  "AdminUser",
  "Refund",
];

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

export default async function SuperAdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    actorType?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const sp = await searchParams;
  const actorTypeParam = sp.actorType || undefined;
  const actionParam = sp.action?.trim() || undefined;
  const targetTypeParam = sp.targetType || undefined;
  const from = sp.from ? new Date(sp.from + "T00:00:00") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(actorTypeParam && actorTypeParam !== "all"
      ? { actorType: actorTypeParam as never }
      : {}),
    ...(actionParam ? { action: { contains: actionParam, mode: "insensitive" as never } } : {}),
    ...(targetTypeParam ? { targetType: targetTypeParam } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      include: {
        adminUser: { select: { id: true, name: true, email: true } },
        operator: {
          select: {
            id: true,
            name: true,
            venue: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.adminAuditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function qs(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      actorType: sp.actorType,
      action: sp.action,
      targetType: sp.targetType,
      from: sp.from,
      to: sp.to,
      page: sp.page,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString() ? `?${params.toString()}` : "";
  }

  // Build export URL
  const exportParams = new URLSearchParams();
  if (actorTypeParam) exportParams.set("actorType", actorTypeParam);
  if (actionParam) exportParams.set("action", actionParam);
  if (targetTypeParam) exportParams.set("targetType", targetTypeParam);
  if (sp.from) exportParams.set("from", sp.from);
  if (sp.to) exportParams.set("to", sp.to);
  const exportUrl = `/api/superadmin/audit/export${
    exportParams.toString() ? `?${exportParams.toString()}` : ""
  }`;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Link
              href="/superadmin"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← Super Admin
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Audit Log</h1>
          </div>
          <a
            href={exportUrl}
            className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
          >
            Esporta CSV
          </a>
        </div>

        {/* Filters */}
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Tipo attore</label>
            <select
              name="actorType"
              defaultValue={sp.actorType ?? "all"}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="all">Tutti</option>
              <option value="ADMIN_USER">Admin</option>
              <option value="OPERATOR">Operatore</option>
              <option value="SYSTEM">Sistema</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Azione</label>
            <input
              type="text"
              name="action"
              defaultValue={sp.action ?? ""}
              placeholder="REFUND_APPROVED…"
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-500 w-44"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Target type</label>
            <select
              name="targetType"
              defaultValue={sp.targetType ?? ""}
              className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">Tutti</option>
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
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
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
            >
              Filtra
            </button>
            <Link
              href="/superadmin/audit"
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
            >
              Reset
            </Link>
          </div>
        </form>

        <p className="text-sm text-zinc-400">{total} log trovati</p>

        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">
                  Attore
                </th>
                <th className="text-left px-4 py-3">Azione</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">
                  Target
                </th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const actorLabel =
                  log.actorType === "ADMIN_USER"
                    ? log.adminUser?.email ?? "—"
                    : log.actorType === "OPERATOR"
                    ? `${log.operator?.name ?? "—"}${log.operator?.venue ? ` (${log.operator.venue.name})` : ""}`
                    : "Sistema";

                return (
                  <AuditLogRow
                    key={log.id}
                    logId={log.id}
                    timestamp={formatDT(log.createdAt)}
                    actorType={log.actorType}
                    actorLabel={actorLabel}
                    action={log.action}
                    targetType={log.targetType}
                    targetId={log.targetId}
                    payload={log.payload}
                  />
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    Nessun log trovato
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
                  href={`/superadmin/audit${qs({ page: String(page - 1) })}`}
                  className="px-3 py-1 rounded-lg border border-zinc-700 hover:border-zinc-500"
                >
                  ←
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/superadmin/audit${qs({ page: String(page + 1) })}`}
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
