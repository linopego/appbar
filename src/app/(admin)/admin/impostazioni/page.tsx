import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { isFiscalModuleConfigured } from "@/lib/fiscal/config";
import { canEnableFiscal } from "@/lib/fiscal/emit";
import { RefundWindowsEditor } from "./refund-windows-editor";
import { DailyReportToggle } from "./daily-report-toggle";
import { FiscalToggle } from "./fiscal-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impostazioni — Admin" };

export interface RefundWindow {
  day: number;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

const IANA_TIMEZONES = [
  "Europe/Rome",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "UTC",
];

export default async function ImpostazioniPage() {
  const session = await requireStaffRole(["MANAGER"]).catch(() => null);
  if (!session) redirect("/");

  const venue = await db.venue.findUnique({
    where: { id: session.venueId },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      refundBlockedWindows: true,
      refundBlockedTimezone: true,
      dailyReportEnabled: true,
      fiscalEnabled: true,
      fiscalConfig: true,
      priceTiers: { where: { active: true }, select: { name: true, vatRate: true } },
    },
  });

  if (!venue) redirect("/");

  const windows = (venue.refundBlockedWindows as RefundWindow[] | null) ?? [];

  // Precondizioni di attivazione fiscale + eventuali documenti in sofferenza
  const moduleConfigured = isFiscalModuleConfigured();
  const gate = canEnableFiscal(venue.priceTiers, venue.fiscalConfig);
  const fiscalBlockedReason = !moduleConfigured
    ? "modulo fiscale non configurato a livello piattaforma"
    : gate.ok
      ? null
      : (gate.reason ?? "precondizioni mancanti");

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const [fiscalFailedCount, fiscalStaleCount] = venue.fiscalEnabled
    ? await Promise.all([
        db.fiscalDocument.count({ where: { venueId: venue.id, status: "FAILED" } }),
        db.fiscalDocument.count({
          where: {
            venueId: venue.id,
            status: { in: ["PENDING", "SUBMITTED"] },
            createdAt: { lt: dayAgo },
          },
        }),
      ])
    : [0, 0];

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900">Impostazioni venue</h1>

      {/* Read-only venue info */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 divide-y divide-zinc-100">
        <div className="pb-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Dati venue</p>
          <p className="text-xs text-zinc-400 mt-1">Modificabili solo dal super-admin</p>
        </div>
        <div className="pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Nome</span>
            <span className="font-medium text-zinc-900">{venue.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Slug</span>
            <span className="font-mono text-xs text-zinc-600">{venue.slug}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Stato</span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${venue.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
              {venue.active ? "Attivo" : "Disattivato"}
            </span>
          </div>
        </div>
      </div>

      {/* QR stampabile del locale */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">QR del locale</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Scarica il QR in alta risoluzione da stampare ed esporre al banco: i clienti lo
            inquadrano e arrivano direttamente alla pagina d&apos;acquisto. Contiene solo il
            link pubblico del locale.
          </p>
        </div>
        {/* Download di file da API route: serve <a> nativo, non <Link> */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/admin/venue/qr-poster"
          className="inline-block px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 text-sm font-medium transition-colors"
        >
          Scarica QR del locale (PNG)
        </a>
      </div>

      {/* Report corrispettivi: email giornaliera on/off */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <DailyReportToggle initialEnabled={venue.dailyReportEnabled} />
      </div>

      {/* Fiscale: emissione automatica del documento commerciale */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Fiscale</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Emissione automatica del documento commerciale via provider fiscale.
          </p>
        </div>

        {/* Stato configurazione */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Modulo piattaforma</span>
            <span className={moduleConfigured ? "text-green-700 font-medium" : "text-zinc-400"}>
              {moduleConfigured ? "Configurato" : "Non configurato"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Configurazione esercente</span>
            <span className={venue.fiscalConfig ? "text-green-700 font-medium" : "text-zinc-400"}>
              {venue.fiscalConfig ? "Presente" : "Assente (a cura della piattaforma)"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Aliquote IVA sul listino</span>
            <span
              className={
                venue.priceTiers.every((t) => t.vatRate !== null)
                  ? "text-green-700 font-medium"
                  : "text-amber-700 font-medium"
              }
            >
              {venue.priceTiers.every((t) => t.vatRate !== null)
                ? "Complete"
                : `Mancanti su ${venue.priceTiers.filter((t) => t.vatRate === null).length} fasce attive`}
            </span>
          </div>
        </div>

        {/* Evidenza documenti in sofferenza */}
        {(fiscalFailedCount > 0 || fiscalStaleCount > 0) && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
            <p className="font-medium">Documenti fiscali da controllare</p>
            {fiscalFailedCount > 0 && (
              <p>
                {fiscalFailedCount} document{fiscalFailedCount === 1 ? "o" : "i"} in errore
                definitivo: apri l&apos;ordine e usa &ldquo;Riprova&rdquo; dopo aver risolto la causa.
              </p>
            )}
            {fiscalStaleCount > 0 && (
              <p>
                {fiscalStaleCount} document{fiscalStaleCount === 1 ? "o" : "i"} in attesa da
                più di 24 ore.
              </p>
            )}
            <p>
              <Link href="/admin/ordini" className="underline">
                Vai agli ordini →
              </Link>
            </p>
          </div>
        )}

        <div className="border-t border-zinc-100 pt-4">
          <FiscalToggle initialEnabled={venue.fiscalEnabled} blockedReason={fiscalBlockedReason} />
        </div>
      </div>

      {/* Editable: refund windows + timezone */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Fasce orarie blocco rimborso</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Durante queste finestre i clienti non possono inviare richieste di rimborso (es. durante l&apos;evento aperto).
          </p>
        </div>

        <RefundWindowsEditor
          initialWindows={windows}
          initialTimezone={venue.refundBlockedTimezone}
          timezoneOptions={IANA_TIMEZONES}
        />
      </div>
    </div>
  );
}
