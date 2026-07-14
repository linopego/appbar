import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

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

export default async function SuperAdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const { id } = await params;

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, email: true, firstName: true, lastName: true } },
      venue: { select: { id: true, name: true } },
      priceTier: { select: { name: true, price: true } },
      order: { select: { id: true } },
      operator: { select: { name: true } },
    },
  });

  if (!ticket) notFound();

  const customerName =
    [ticket.customer.firstName, ticket.customer.lastName]
      .filter(Boolean)
      .join(" ") || ticket.customer.email;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-1">
          <Link
            href="/superadmin/tickets"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Ticket
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">Ticket</h1>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                TICKET_STATUS_COLORS[ticket.status] ?? "bg-zinc-800 text-zinc-400"
              }`}
            >
              {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <div>
            <p className="text-xs text-zinc-400 mb-1">QR Token</p>
            <p className="font-mono text-sm text-zinc-100 break-all">{ticket.qrToken}</p>
          </div>

          <div className="border-t border-zinc-800 pt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-400 mb-1">Venue</p>
              <Link
                href={`/superadmin/venues/${ticket.venue.id}`}
                className="text-sm text-zinc-300 hover:text-zinc-50 underline"
              >
                {ticket.venue.name}
              </Link>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">Tier</p>
              <p className="text-sm text-zinc-200">
                {ticket.priceTier.name} —{" "}
                {formatEur(ticket.priceTier.price.toString())}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">Cliente</p>
              <p className="text-sm text-zinc-200">{customerName}</p>
              <p className="text-xs text-zinc-500">{ticket.customer.email}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">Ordine</p>
              <Link
                href={`/superadmin/ordini/${ticket.order.id}`}
                className="text-sm text-zinc-300 hover:text-zinc-50 underline"
              >
                #{ticket.order.id.slice(0, 8).toUpperCase()}
              </Link>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">Creato il</p>
              <p className="text-sm text-zinc-200">{formatDT(ticket.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">Scade il</p>
              <p className="text-sm text-zinc-200">{formatDT(ticket.expiresAt)}</p>
            </div>
            {ticket.consumedAt && (
              <>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Consegnato il</p>
                  <p className="text-sm text-zinc-200">
                    {formatDT(ticket.consumedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Consegnato da</p>
                  <p className="text-sm text-zinc-200">
                    {ticket.operator?.name ?? "—"}
                  </p>
                </div>
              </>
            )}
            {ticket.refundedAt && (
              <div>
                <p className="text-xs text-zinc-400 mb-1">Rimborsato il</p>
                <p className="text-sm text-zinc-200">
                  {formatDT(ticket.refundedAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
