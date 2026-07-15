"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Stato di una capability Stripe: "active" | "pending" | "inactive" | null
// (null = mai richiesta o stato non disponibile → di fatto mancante)
interface Capabilities {
  cardPayments: string | null;
  transfers: string | null;
}

function capabilityLabel(status: string | null) {
  if (status === "active") {
    return <span className="text-xs text-green-400">attiva</span>;
  }
  if (status === "pending") {
    return <span className="text-xs text-yellow-400">in attesa di Stripe</span>;
  }
  return <span className="text-xs text-red-400">mancante</span>;
}

export function OrganizationStripeSection({
  organizationId,
  hasAccount,
  chargesEnabled,
  detailsSubmitted,
  capabilities,
}: {
  organizationId: string;
  hasAccount: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  // null = stato Stripe non recuperato (account assente o Stripe non raggiungibile)
  capabilities: Capabilities | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [repairDone, setRepairDone] = useState(false);

  async function createAccount() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/superadmin/organizations/${organizationId}/stripe/account`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nella creazione dell'account.");
        return;
      }
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function repairCapabilities() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/superadmin/organizations/${organizationId}/stripe/repair-capabilities`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Errore nella riparazione. Riprova."
        );
        return;
      }
      setRepairDone(true);
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function generateOnboardingLink() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(
        `/api/superadmin/organizations/${organizationId}/stripe/onboarding-link`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : (data.error?.message ?? "Errore nella generazione del link.")
        );
        return;
      }
      setOnboardingUrl(data.data.url as string);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!onboardingUrl) return;
    try {
      await navigator.clipboard.writeText(onboardingUrl);
      setCopied(true);
    } catch {
      setError("Copia non riuscita: seleziona e copia il link manualmente.");
    }
  }

  // Stato reale delle capabilities (recuperato da Stripe a ogni caricamento)
  const capabilitiesBlock = hasAccount && (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      {capabilities ? (
        <ul className="space-y-1.5">
          <li className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-400">
              Incasso con carta <span className="font-mono">card_payments</span>
            </span>
            {capabilityLabel(capabilities.cardPayments)}
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-400">
              Trasferimenti <span className="font-mono">transfers</span>
            </span>
            {capabilityLabel(capabilities.transfers)}
          </li>
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">
          Stato capabilities non disponibile in questo momento (Stripe non raggiungibile):
          mostrato lo stato locale.
        </p>
      )}
    </div>
  );

  // Account presente ma incasso con carta non attivo: la capability non è
  // stata richiesta alla creazione (bug pre-fix) o è ancora in revisione
  const needsRepair = hasAccount && capabilities !== null && capabilities.cardPayments !== "active";

  const repairBlock = needsRepair && (
    <div className="rounded-lg border border-yellow-900/40 bg-yellow-900/20 p-3 space-y-2">
      <p className="text-xs text-yellow-400/90">
        ⚠️ Incasso con carta non attivo: Stripe rifiuta i pagamenti su questo account.
        «Ripara» richiede le capabilities mancanti (card_payments, transfers).
      </p>
      {repairDone ? (
        <p className="text-xs text-green-400">
          ✓ Capabilities richieste. Ora rigenera il link onboarding e invialo al cliente:
          Stripe potrebbe chiedere dati aggiuntivi prima di attivarle.
        </p>
      ) : (
        <button
          onClick={repairCapabilities}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "Riparazione…" : "Ripara"}
        </button>
      )}
    </div>
  );

  // Pagamenti già attivi: nessuna azione necessaria
  if (chargesEnabled) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          L&apos;organizzazione può incassare: onboarding completato e pagamenti abilitati da
          Stripe.
        </p>
        {capabilitiesBlock}
        {repairBlock}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hasAccount ? (
        <>
          <p className="text-sm text-zinc-400">
            Nessun account Stripe collegato. Primo passo: crea l&apos;account (il cliente
            completerà poi l&apos;onboarding con i propri dati).
          </p>
          <button
            onClick={createAccount}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Creazione…" : "Crea account Stripe"}
          </button>
        </>
      ) : (
        <>
          {capabilitiesBlock}
          {repairBlock}
          <p className="text-sm text-zinc-400">
            {detailsSubmitted
              ? "Dati inviati a Stripe, in attesa dell'abilitazione dei pagamenti. Se serve, genera un nuovo link per completare eventuali richieste aggiuntive."
              : "Account creato, onboarding da completare. Genera il link e invialo al cliente: lo aprirà per inserire i propri dati (identità, IBAN…)."}
          </p>
          <button
            onClick={generateOnboardingLink}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Generazione…" : "Genera link onboarding"}
          </button>

          {onboardingUrl && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 space-y-2">
              <p className="text-xs break-all text-zinc-300 font-mono">{onboardingUrl}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={copyUrl}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 transition-colors"
                >
                  {copied ? "✓ Copiato" : "Copia negli appunti"}
                </button>
                <p className="text-xs text-yellow-400/90">
                  ⚠️ Il link scade dopo pochi minuti: invialo subito. Se scade, generane uno
                  nuovo.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
