import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { RefundStatusBadge } from "@/components/shared/refund-status-badge";
import { formatEur } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(d));
}

export default async function RimborsiPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const refunds = await db.refund.findMany({
    where: { order: { customerId: session.user.id } },
    include: {
      order: { include: { venue: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <main className="min-h-dvh bg-zinc-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Link href="/profilo" className="text-sm text-zinc-500 hover:text-zinc-800">
              ← Profilo
            </Link>
            <h1 className="text-2xl font-bold text-zinc-900">I miei rimborsi</h1>
          </div>
        </div>

        {refunds.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <p>Nessuna richiesta di rimborso</p>
          </div>
        ) : (
          <div className="space-y-3">
            {refunds.map((refund) => (
              <Link
                key={refund.id}
                href={`/profilo/rimborsi/${refund.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400 transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-medium text-zinc-900">{refund.order.venue.name}</p>
                    <p className="text-sm text-zinc-500">
                      {(refund.ticketIds as string[]).length} ticket · {formatEur(refund.amount.toString())}
                    </p>
                  </div>
                  <RefundStatusBadge status={refund.status} />
                </div>
                <p className="text-xs text-zinc-400">{formatDate(refund.requestedAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
