import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminOrManagerSession } from "@/lib/auth/admin-or-manager";
import { db } from "@/lib/db";
import { RefundStatusBadge } from "@/components/shared/refund-status-badge";
import { formatEur } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

type TabStatus = "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

const TABS: { status: TabStatus; label: string }[] = [
  { status: "PENDING", label: "Pendenti" },
  { status: "APPROVED", label: "Approvati" },
  { status: "COMPLETED", label: "Completati" },
  { status: "REJECTED", label: "Rifiutati" },
];

export default async function AdminRimborsiPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await getAdminOrManagerSession();
  if (!session) redirect("/");

  const { status: rawStatus, page: rawPage } = await searchParams;
  const status: TabStatus =
    (["PENDING", "APPROVED", "COMPLETED", "REJECTED"] as TabStatus[]).includes(rawStatus as TabStatus)
      ? (rawStatus as TabStatus)
      : "PENDING";
  const page = Math.max(1, parseInt(rawPage ?? "1", 10));
  const pageSize = 20;

  const venueFilter =
    session.kind === "manager" ? { order: { venueId: session.session.venueId } } : {};

  const [refunds, total] = await Promise.all([
    db.refund.findMany({
      where: { status, ...venueFilter },
      include: {
        order: {
          include: {
            customer: { select: { email: true, firstName: true, lastName: true } },
            venue: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.refund.count({ where: { status, ...venueFilter } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isAdmin = session.kind === "admin";
  const backHref = isAdmin ? "/superadmin" : `/staff/${session.session.venueSlug}/pos`;

  return (
    <main className="min-h-dvh bg-zinc-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <Link href={backHref} className="text-sm text-zinc-500 hover:text-zinc-800">
            ← {isAdmin ? "Super Admin" : "POS"}
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">Gestione rimborsi</h1>
          {session.kind === "manager" && (
            <p className="text-sm text-zinc-500">Solo il tuo venue</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-200">
          {TABS.map((tab) => (
            <Link
              key={tab.status}
              href={`/admin/rimborsi?status=${tab.status}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                status === tab.status
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {refunds.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <p>Nessuna richiesta di rimborso in questa categoria</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden bg-white">
            {refunds.map((refund) => {
              const customer = refund.order.customer;
              const customerLabel = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;

              return (
                <Link
                  key={refund.id}
                  href={`/admin/rimborsi/${refund.id}`}
                  className="flex items-start gap-4 px-4 py-4 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-zinc-900 truncate">{customerLabel}</span>
                      {isAdmin && (
                        <span className="text-xs text-zinc-400 shrink-0">{refund.order.venue.name}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{refund.reason || refund.customerNote || "—"}</p>
                    <p className="text-xs text-zinc-400">{formatDate(refund.requestedAt)}</p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <p className="font-semibold text-sm">{formatEur(refund.amount.toString())}</p>
                    <p className="text-xs text-zinc-500">{(refund.ticketIds as string[]).length} ticket</p>
                    <RefundStatusBadge status={refund.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center text-sm text-zinc-500">
            <span>Pagina {page} di {totalPages} ({total} totali)</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/rimborsi?status=${status}&page=${page - 1}`}
                  className="px-3 py-1 rounded-lg border border-zinc-200 hover:border-zinc-400"
                >
                  ←
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/rimborsi?status=${status}&page=${page + 1}`}
                  className="px-3 py-1 rounded-lg border border-zinc-200 hover:border-zinc-400"
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
