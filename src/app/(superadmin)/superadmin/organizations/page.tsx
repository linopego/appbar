import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import { getAllOrgStats30d } from "@/lib/organizations/stats";
import { NewOrganizationDialog } from "./new-organization-dialog";
import { StripeStatusBadge } from "./stripe-status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organizzazioni — Super Admin" };

export default async function OrganizationsPage() {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");
  // Gestione organizzazioni: solo admin di piattaforma
  if (session.role !== "PLATFORM") redirect("/superadmin");

  const [organizations, stats] = await Promise.all([
    db.organization.findMany({
      include: { _count: { select: { venues: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getAllOrgStats30d(new Date()),
  ]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/superadmin" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← Super Admin
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Organizzazioni</h1>
          </div>
          <NewOrganizationDialog />
        </div>

        {organizations.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
            <p className="text-zinc-400">Nessuna organizzazione presente.</p>
            <p className="text-sm text-zinc-500 mt-1">
              Crea la prima organizzazione cliente con il pulsante «Nuova organizzazione».
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Stripe</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Fee %</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Venue</th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">GMV 30gg</th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">Fee 30gg</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Stato</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => {
                  const s = stats.get(org.id);
                  return (
                    <tr key={org.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/superadmin/organizations/${org.id}`}
                          className="font-medium text-zinc-100 hover:underline"
                        >
                          {org.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StripeStatusBadge
                          hasAccount={org.stripeAccountId !== null}
                          chargesEnabled={org.stripeChargesEnabled}
                        />
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell tabular-nums">
                        {org.feePercent.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell tabular-nums">
                        {org._count.venues}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell tabular-nums">
                        {formatEur(s?.gmv ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell tabular-nums">
                        {formatEur(s?.fees ?? 0)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {org.active ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-900/50 text-green-400">
                            Attiva
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-red-900/50 text-red-400">
                            Disattivata
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
