import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import { VenueToggleActiveButton } from "./toggle-active-button";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  BARISTA: "Barista",
  CASSIERE: "Cassiere",
  MANAGER: "Manager",
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

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const { id } = await params;

  const venue = await db.venue.findUnique({
    where: { id },
    include: {
      operators: { orderBy: [{ role: "asc" }, { name: "asc" }] },
      priceTiers: { orderBy: { sortOrder: "asc" } },
      _count: { select: { orders: true, tickets: true } },
    },
  });

  if (!venue) notFound();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-1">
          <Link
            href="/superadmin/venues"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Venue
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{venue.name}</h1>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                venue.active
                  ? "bg-green-900/50 text-green-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {venue.active ? "Attivo" : "Inattivo"}
            </span>
          </div>
        </div>

        {/* Info card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Informazioni
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-400 text-xs mb-1">Nome</p>
              <p className="text-zinc-100">{venue.name}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Slug</p>
              <p className="text-zinc-100 font-mono">{venue.slug}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Stato</p>
              <p className="text-zinc-100">{venue.active ? "Attivo" : "Inattivo"}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Timezone</p>
              <p className="text-zinc-100">{venue.refundBlockedTimezone || "—"}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Ordini totali</p>
              <p className="text-zinc-100">{venue._count.orders}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Ticket totali</p>
              <p className="text-zinc-100">{venue._count.tickets}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href={`/superadmin/venues/${id}/modifica`}
              className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
            >
              Modifica
            </Link>
            <VenueToggleActiveButton
              venueId={id}
              active={venue.active}
              name={venue.name}
            />
          </div>
        </div>

        {/* Operators */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">
            Operatori ({venue.operators.length})
          </h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">
                    Ruolo
                  </th>
                  <th className="text-left px-4 py-3">Stato</th>
                </tr>
              </thead>
              <tbody>
                {venue.operators.map((op) => (
                  <tr
                    key={op.id}
                    className="border-b border-zinc-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-zinc-100">{op.name}</div>
                      {op.email && (
                        <div className="text-xs text-zinc-400">{op.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-300 hidden sm:table-cell">
                      {ROLE_LABELS[op.role] ?? op.role}
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
                  </tr>
                ))}
                {venue.operators.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      Nessun operatore.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Price tiers */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">
            Listino ({venue.priceTiers.length} fasce)
          </h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-right px-4 py-3">Prezzo</th>
                  <th className="text-left px-4 py-3">Stato</th>
                </tr>
              </thead>
              <tbody>
                {venue.priceTiers.map((tier) => (
                  <tr
                    key={tier.id}
                    className="border-b border-zinc-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-100">{tier.name}</td>
                    <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                      {formatEur(tier.price.toString())}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          tier.active
                            ? "bg-green-900/50 text-green-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {tier.active ? "Attivo" : "Inattivo"}
                      </span>
                    </td>
                  </tr>
                ))}
                {venue.priceTiers.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      Nessuna fascia prezzo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Link rapidi</h2>
          <div className="flex gap-4 flex-wrap">
            <Link
              href={`/superadmin/ordini?venueId=${id}`}
              className="text-zinc-300 hover:text-zinc-50 underline text-sm"
            >
              Vedi ordini →
            </Link>
            <Link
              href={`/superadmin/operatori?venueId=${id}`}
              className="text-zinc-300 hover:text-zinc-50 underline text-sm"
            >
              Vedi operatori →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
