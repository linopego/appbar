"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrganizationStripeSection({
  organizationId,
  hasAccount,
  chargesEnabled,
  detailsSubmitted,
}: {
  organizationId: string;
  hasAccount: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  // Pagamenti già attivi: nessuna azione necessaria
  if (chargesEnabled) {
    return (
      <p className="text-sm text-zinc-400">
        L&apos;organizzazione può incassare: onboarding completato e pagamenti abilitati da
        Stripe.
      </p>
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
