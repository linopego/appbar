"use client";

import { useState } from "react";

// Interruttori impostazioni venue lato superadmin (tema scuro):
// riusano gli endpoint scopati /api/superadmin/venues/[id]/*.

function Switch({
  enabled,
  disabled,
  onClick,
}: {
  enabled: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        enabled ? "bg-klink-lime" : "bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function useToggle(endpoint: string, initialEnabled: boolean) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (saving) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nel salvataggio.");
        return;
      }
      setEnabled(next);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return { enabled, saving, error, toggle };
}

export function DailyReportToggleSA({
  venueId,
  initialEnabled,
}: {
  venueId: string;
  initialEnabled: boolean;
}) {
  const t = useToggle(`/api/superadmin/venues/${venueId}/daily-report`, initialEnabled);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-200">Email giornaliera dei corrispettivi</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Ogni mattina alle 7:00 (ora italiana) il riepilogo del giorno precedente ai
            responsabili del locale, solo se ci sono stati movimenti.
          </p>
        </div>
        <Switch enabled={t.enabled} disabled={t.saving} onClick={t.toggle} />
      </div>
      {t.error && <p className="text-sm text-red-400">{t.error}</p>}
    </div>
  );
}

export function FiscalToggleSA({
  venueId,
  initialEnabled,
  // Motivo per cui l'attivazione è bloccata (null = attivabile). Il server
  // rifà comunque il controllo: qui serve solo a spiegare in UI.
  blockedReason,
  missingVatRates,
}: {
  venueId: string;
  initialEnabled: boolean;
  blockedReason: string | null;
  missingVatRates: boolean;
}) {
  const t = useToggle(`/api/superadmin/venues/${venueId}/fiscal`, initialEnabled);
  const blocked = !t.enabled && blockedReason !== null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-200">
            Emissione automatica del documento commerciale
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Per ogni ordine pagato viene trasmesso il documento commerciale tramite il
            provider configurato. La vendita non dipende mai dall&apos;esito fiscale.
          </p>
        </div>
        <Switch enabled={t.enabled} disabled={t.saving || blocked} onClick={t.toggle} />
      </div>
      {blocked && (
        <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-900/50 rounded-lg px-3 py-2">
          Attivazione non disponibile: {blockedReason}
          {missingVatRates && (
            <>
              {" "}
              <a href="#listino" className="underline font-medium hover:text-amber-300">
                Completa le aliquote del listino
              </a>
            </>
          )}
        </p>
      )}
      <p className="text-xs text-zinc-500 italic">
        Attivare solo previa conferma del consulente fiscale dell&apos;esercente.
      </p>
      {t.error && <p className="text-sm text-red-400">{t.error}</p>}
    </div>
  );
}
