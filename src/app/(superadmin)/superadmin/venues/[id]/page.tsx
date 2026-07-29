import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { orgScopeWhere } from "@/lib/auth/org-scope";
import { db } from "@/lib/db";
import { VenueToggleActiveButton } from "./toggle-active-button";
import { FiscalConfigForm } from "./fiscal-config-form";
import { PriceTiersManager } from "./price-tiers-manager";
import { DailyReportToggleSA, FiscalToggleSA } from "./venue-settings-toggles";
import { RefundWindowsEditor } from "@/components/shared/refund-windows-editor";
import { OPERATOR_ROLE_LABELS } from "@/lib/labels/roles";
import { isFiscalModuleConfigured } from "@/lib/fiscal/config";
import { canEnableFiscal } from "@/lib/fiscal/emit";
import {
  REFUND_TIMEZONE_OPTIONS,
  type RefundWindow,
} from "@/lib/venue-settings/validation";
import type { FiscalVenueConfig } from "@/lib/fiscal/types";

export const dynamic = "force-dynamic";

const ROLE_LABELS = OPERATOR_ROLE_LABELS;

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/superadmin/login");

  const { id } = await params;

  const venue = await db.venue.findFirst({
    where: { id, ...orgScopeWhere(session).venue },
    include: {
      operators: { orderBy: [{ role: "asc" }, { name: "asc" }] },
      priceTiers: { orderBy: { sortOrder: "asc" } },
      _count: { select: { orders: true, tickets: true } },
    },
  });

  if (!venue) notFound();

  const fiscalConfig = (venue.fiscalConfig ?? null) as FiscalVenueConfig | null;
  // Fasce attive senza aliquota: bloccano l'attivazione del modulo fiscale
  const missingVatCount = venue.priceTiers.filter((t) => t.active && t.vatRate === null).length;

  // Precondizioni del toggle fiscale: IDENTICHE al pannello del responsabile
  // (stessa canEnableFiscal condivisa)
  const moduleConfigured = isFiscalModuleConfigured();
  const activeTiers = venue.priceTiers.filter((t) => t.active);
  const gate = canEnableFiscal(activeTiers, venue.fiscalConfig);
  const fiscalBlockedReason = !moduleConfigured
    ? "modulo fiscale non configurato a livello piattaforma"
    : gate.ok
      ? null
      : (gate.reason ?? "precondizioni mancanti");

  const refundWindows = (venue.refundBlockedWindows as RefundWindow[] | null) ?? [];

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
            <a
              href={`/api/superadmin/venues/${id}/qr-poster`}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 text-sm font-medium transition-colors"
            >
              Scarica QR del locale
            </a>
          </div>
        </div>

        {/* Fiscale: stato per tutti, configurazione SOLO PLATFORM */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              Fiscale
            </h2>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                venue.fiscalEnabled
                  ? "bg-green-900/50 text-green-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {venue.fiscalEnabled ? "Emissione attiva" : "Emissione disattivata"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-400 text-xs mb-1">Identificativo fiscale</p>
              <p className="text-zinc-100 font-mono">{fiscalConfig?.fiscalId ?? "—"}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">ID configurazione provider</p>
              <p className="text-zinc-100 font-mono">{fiscalConfig?.configurationId ?? "—"}</p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Segreti esercente</p>
              <p className="text-zinc-100">
                {fiscalConfig?.encryptedSecrets ? "Presenti (cifrati)" : "Assenti"}
              </p>
            </div>
          </div>

          {missingVatCount > 0 && (
            <p className="text-sm text-amber-400 bg-amber-900/20 border border-amber-900/50 rounded-lg px-3 py-2">
              {missingVatCount} fasc{missingVatCount === 1 ? "ia attiva" : "e attive"} senza
              aliquota IVA: l&apos;attivazione del fiscale resta bloccata.{" "}
              <a href="#listino" className="underline hover:text-amber-300">
                Completa le aliquote del listino
              </a>
            </p>
          )}

          {/* Toggle emissione: stesse precondizioni del pannello responsabile */}
          <div className="border-t border-zinc-800 pt-4">
            <FiscalToggleSA
              venueId={id}
              initialEnabled={venue.fiscalEnabled}
              blockedReason={fiscalBlockedReason}
              missingVatRates={moduleConfigured && missingVatCount > 0}
            />
          </div>

          {session.role === "PLATFORM" ? (
            <div className="border-t border-zinc-800 pt-4">
              <FiscalConfigForm
                venueId={id}
                initialFiscalId={fiscalConfig?.fiscalId ?? ""}
                initialConfigurationId={fiscalConfig?.configurationId ?? ""}
                hasSecrets={Boolean(fiscalConfig?.encryptedSecrets)}
              />
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              La configurazione fiscale è gestita dall&apos;amministratore di piattaforma.
            </p>
          )}
        </div>

        {/* Impostazioni venue: stesse capacità del pannello responsabile */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Impostazioni
          </h2>

          <DailyReportToggleSA venueId={id} initialEnabled={venue.dailyReportEnabled} />

          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-zinc-200">Fasce orarie blocco rimborso</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Durante queste finestre i clienti non possono inviare richieste di rimborso
                (es. durante l&apos;evento aperto).
              </p>
            </div>
            <RefundWindowsEditor
              initialWindows={refundWindows}
              initialTimezone={venue.refundBlockedTimezone}
              timezoneOptions={REFUND_TIMEZONE_OPTIONS}
              endpoint={`/api/superadmin/venues/${id}/refund-windows`}
              theme="dark"
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

        {/* Price tiers: gestione completa (crea/modifica/disattiva), scoping lato API */}
        <div id="listino" className="scroll-mt-6">
          <PriceTiersManager
            venueId={id}
            tiers={venue.priceTiers.map((tier) => ({
              id: tier.id,
              name: tier.name,
              price: tier.price.toString(),
              vatRate: tier.vatRate?.toString() ?? null,
              sortOrder: tier.sortOrder,
              active: tier.active,
            }))}
          />
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
            <Link
              href={`/superadmin/statistiche?venueId=${id}`}
              className="text-zinc-300 hover:text-zinc-50 underline text-sm"
            >
              Statistiche →
            </Link>
            <Link
              href={`/superadmin/corrispettivi?venueId=${id}`}
              className="text-zinc-300 hover:text-zinc-50 underline text-sm"
            >
              Corrispettivi →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
