import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
import { LiveDashboard } from "@/components/reports/live-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Serata live — Super Admin" };

// Serata live per venue, scopata: ORG_ADMIN vede solo i venue della propria
// organizzazione. Giornata operativa 06:00→06:00 Europe/Rome.
export default async function SuperadminLivePage({
  searchParams,
}: {
  searchParams: Promise<{ venueId?: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const scope = orgScopeWhere(session);
  const venues = await db.venue.findMany({
    where: scope.venue,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const sp = await searchParams;
  const selectedVenue = sp.venueId ? (venues.find((v) => v.id === sp.venueId) ?? null) : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Serata live</h1>
          <p className="text-sm text-zinc-400 mt-1">
            La serata mentre accade, aggiornata ogni 20 secondi. Serata dalle 06:00
            alle 06:00 (ora italiana).
          </p>
        </div>

        <form method="get" className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-zinc-500 mb-1">Venue</span>
            <select
              name="venueId"
              defaultValue={selectedVenue?.id ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">— Seleziona venue —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
          >
            Apri
          </button>
        </form>

        {selectedVenue ? (
          <LiveDashboard
            endpoint={`/api/superadmin/live?venueId=${selectedVenue.id}`}
            theme="dark"
          />
        ) : (
          <p className="text-sm text-zinc-500">Seleziona un venue per aprire la serata.</p>
        )}
      </div>
    </main>
  );
}
