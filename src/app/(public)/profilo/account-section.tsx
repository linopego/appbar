"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

// "Il mio account": export dei dati (portabilità) e cancellazione con doppia
// conferma (diritto all'oblio). L'eliminazione ANONIMIZZA: i dati contabili
// restano, la PII no.
export function AccountSection() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    // Seconda conferma: la prima è l'apertura del pannello di avviso
    if (
      !confirm(
        "Confermi l'eliminazione definitiva del tuo account?\n\nI ticket attivi non ancora usati verranno annullati senza rimborso. L'operazione non è reversibile."
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : (data.error?.message ?? "Eliminazione non riuscita. Riprova.")
        );
        return;
      }
      // Sessione già invalidata lato server: si esce e si torna alla home
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Portabilità */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Scarica i miei dati</p>
          <p className="text-xs text-muted-foreground">
            Profilo, ordini, ticket e richieste di rimborso in formato JSON (max 1 richiesta
            all&apos;ora).
          </p>
        </div>
        {/* Download da API route: serve <a> nativo, non <Link> */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/account/export"
          className="shrink-0 px-4 py-2 rounded-full border border-klink-ink text-klink-ink text-sm font-medium hover:bg-klink-ink/5 transition-colors"
        >
          Scarica
        </a>
      </div>

      {/* Diritto all'oblio */}
      <div className="border-t pt-4 space-y-3">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm font-medium text-klink-error underline underline-offset-4 hover:no-underline"
          >
            Elimina il mio account
          </button>
        ) : (
          <div className="rounded-xl border border-klink-error/40 bg-klink-error-soft p-4 space-y-3">
            <p className="text-sm font-semibold text-klink-error">
              Eliminazione definitiva dell&apos;account
            </p>
            <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
              <li>
                <strong>I ticket attivi non ancora usati verranno annullati senza rimborso.</strong>
              </li>
              <li>I tuoi dati personali verranno anonimizzati e non potrai più accedere.</li>
              <li>
                I dati contabili degli ordini restano conservati per obbligo di legge, in forma
                non riconducibile a te.
              </li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-full bg-klink-error text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleting ? "Eliminazione…" : "Elimina definitivamente"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-full border text-sm font-medium hover:bg-muted transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-klink-error">{error}</p>}
      </div>
    </div>
  );
}
