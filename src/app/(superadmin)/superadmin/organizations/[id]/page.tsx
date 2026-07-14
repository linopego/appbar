import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/utils/money";
import { getOrgStats } from "@/lib/organizations/stats";
import { StripeStatusBadge } from "../stripe-status-badge";
import { OrganizationEditForm } from "./organization-edit-form";
import { OrganizationStripeSection } from "./organization-stripe-section";
import { OrganizationToggleButton } from "./organization-toggle-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organizzazione — Super Admin" };

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");
  if (session.role !== "PLATFORM") redirect("/superadmin");

  const { id } = await params;
  const organization = await db.organization.findUnique({
    where: { id },
    include: {
      venues: {
        select: { id: true, name: true, slug: true, active: true },
        orderBy: { name: "asc" },
      },
      adminUsers: {
        select: { id: true, email: true, name: true, role: true, active: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!organization) notFound();

  const now = new Date();
  const [kpi7, kpi30, kpi90] = await Promise.all([
    getOrgStats(id, 7, now),
    getOrgStats(id, 30, now),
    getOrgStats(id, 90, now),
  ]);
  const kpiRows = [
    { label: "Ultimi 7 giorni", ...kpi7 },
    { label: "Ultimi 30 giorni", ...kpi30 },
    { label: "Ultimi 90 giorni", ...kpi90 },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/superadmin/organizations" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← Organizzazioni
            </Link>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-semibold">{organization.name}</h1>
              {!organization.active && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-red-900/50 text-red-400">
                  Disattivata
                </span>
              )}
            </div>
          </div>
          <OrganizationToggleButton
            organizationId={organization.id}
            active={organization.active}
            name={organization.name}
          />
        </div>

        {/* Anagrafica */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Anagrafica</h2>
          <OrganizationEditForm
            organizationId={organization.id}
            initialName={organization.name}
            initialFeePercent={organization.feePercent.toFixed(2)}
          />
        </section>

        {/* Stripe */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              Pagamenti (Stripe)
            </h2>
            <StripeStatusBadge
              hasAccount={organization.stripeAccountId !== null}
              chargesEnabled={organization.stripeChargesEnabled}
            />
          </div>
          <OrganizationStripeSection
            organizationId={organization.id}
            hasAccount={organization.stripeAccountId !== null}
            chargesEnabled={organization.stripeChargesEnabled}
            detailsSubmitted={organization.stripeDetailsSubmitted}
          />
        </section>

        {/* KPI */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Andamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {kpiRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs text-zinc-500">{row.label}</p>
                <p className="text-lg font-semibold mt-1 tabular-nums">{formatEur(row.gmv)}</p>
                <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
                  Fee piattaforma: {formatEur(row.fees)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Venue */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              Venue ({organization.venues.length})
            </h2>
            <Link
              href={`/superadmin/venues/nuovo?organizationId=${organization.id}`}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium transition-colors"
            >
              + Nuovo venue
            </Link>
          </div>
          {!organization.stripeChargesEnabled && organization.venues.length > 0 && (
            <p className="text-xs text-yellow-400/90 bg-yellow-900/20 border border-yellow-900/40 rounded-lg px-3 py-2">
              ⚠️ Pagamenti non attivi: i clienti non possono ancora acquistare nei venue di
              questa organizzazione. Completa prima l&apos;onboarding Stripe.
            </p>
          )}
          {organization.venues.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nessun venue. Creane uno con «Nuovo venue»: si potrà configurare Stripe anche dopo.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {organization.venues.map((venue) => (
                <li key={venue.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <Link
                      href={`/superadmin/venues/${venue.id}`}
                      className="text-sm font-medium text-zinc-100 hover:underline"
                    >
                      {venue.name}
                    </Link>
                    <span className="ml-2 text-xs text-zinc-500">/{venue.slug}</span>
                  </div>
                  {venue.active ? (
                    <span className="text-xs text-green-400">attivo</span>
                  ) : (
                    <span className="text-xs text-red-400">disattivato</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Admin dell'organizzazione */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              Admin organizzazione ({organization.adminUsers.length})
            </h2>
            <Link
              href={`/superadmin/admin-users/nuovo?organizationId=${organization.id}`}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium transition-colors"
            >
              + Nuovo admin
            </Link>
          </div>
          {organization.adminUsers.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nessun admin: il cliente non può ancora accedere al pannello. Creane uno con
              «Nuovo admin».
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {organization.adminUsers.map((admin) => (
                <li key={admin.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{admin.name}</p>
                    <p className="text-xs text-zinc-500">{admin.email}</p>
                  </div>
                  {admin.active ? (
                    <span className="text-xs text-green-400">attivo</span>
                  ) : (
                    <span className="text-xs text-red-400">disattivato</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
