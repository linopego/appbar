import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rimborsi — Super Admin" };

type TabStatus = "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";

const TABS: { status: TabStatus; label: string }[] = [
  { status: "PENDING", label: "Pendenti" },
  { status: "APPROVED", label: "Approvati" },
  { status: "COMPLETED", label: "Completati" },
  { status: "REJECTED", label: "Rifiutati" },
];

const REFUND_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900/50 text-yellow-400",
  APPROVED: "bg-blue-900/50 text-blue-400",
  COMPLETED: "bg-green-900/50 text-green-400",
  REJECTED: "bg-red-900/50 text-red-400",
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function SuperAdminRimborsiPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const sp = await searchParams;
  const status: TabStatus = (
    ["PENDING", "APPROVED", "COMPLETED", "REJECTED"] as TabStatus[]
  ).includes(sp.status as TabStatus)
    ? (sp.status as TabStatus)
    : "PENDING";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize = 20;

  const [refunds, total] = await Promise.all([
    db.refund.findMany({
      where: { status },
      include: {
        order: {
          include: {
            customer: { select: { email: true, firstName: true, lastName: true } },
            venue: { select: { name: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.refund.count({ where: { status } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link
            href="/superadmin"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Super Admin
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Rimborsi</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Tutti i venue</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          {TABS.map((tab) => (
            <Link
              key={tab.status}
              href={`/superadmin/rimborsi?status=${tab.status}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                status === tab.status
                  ? "border-zinc-100 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {refunds.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <p>Nessuna richiesta di rimborso in questa categoria</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
            {refunds.map((refund) => {
              const customer = refund.order.customer;
              const customerLabel =
                [customer.firstName, customer.lastName]
                  .filter(Boolean)
                  .join(" ") || customer.email;

              return (
                <Link
                  key={refund.id}
                  href={`/admin/rimborsi/${refund.id}`}
                  className="flex items-start gap-4 px-4 py-4 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-zinc-100 truncate">
                        {customerLabel}
                      </span>
                      <span className="text-xs text-zinc-400 shrink-0">
                        {refund.order.venue.name}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      {customer.email}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {refund.reason || refund.customerNote || "—"}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {formatDate(refund.requestedAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <p className="font-semibold text-sm text-zinc-100">
                      {formatEur(refund.amount.toString())}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {(refund.ticketIds as string[]).length} ticket
                    </p>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        REFUND_STATUS_COLORS[refund.status] ??
                        "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {refund.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center text-sm text-zinc-400">
            <span>
              Pagina {page} di {totalPages} ({total} totali)
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/superadmin/rimborsi?status=${status}&page=${page - 1}`}
                  className="px-3 py-1 rounded-lg border border-zinc-700 hover:border-zinc-500"
                >
                  ←
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/superadmin/rimborsi?status=${status}&page=${page + 1}`}
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
