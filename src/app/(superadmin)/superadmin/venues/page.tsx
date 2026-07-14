import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venue — Super Admin" };

function formatDT(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default async function SuperAdminVenuePage() {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const venues = await db.venue.findMany({
    include: { _count: { select: { operators: true, orders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/superadmin" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← Super Admin
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Venue</h1>
          </div>
          <Link
            href="/superadmin/venues/nuovo"
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
          >
            + Nuovo venue
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Nome / Slug</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Stato</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Operatori</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Ordini</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Creato il</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr
                  key={venue.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-100">{venue.name}</div>
                    <div className="text-xs text-zinc-400 font-mono">{venue.slug}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        venue.active
                          ? "bg-green-900/50 text-green-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {venue.active ? "Attivo" : "Inattivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 hidden md:table-cell">
                    {venue._count.operators}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 hidden md:table-cell">
                    {venue._count.orders}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden lg:table-cell">
                    {formatDT(venue.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/superadmin/venues/${venue.id}`}
                      className="text-xs text-zinc-300 hover:text-zinc-50 underline"
                    >
                      Dettaglio →
                    </Link>
                  </td>
                </tr>
              ))}
              {venues.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                    Nessun venue trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
