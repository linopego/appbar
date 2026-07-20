"use client";

import { useState } from "react";

interface Props {
  initialEnabled: boolean;
  // Motivo per cui l'attivazione è bloccata (null = attivabile). Il server
  // rifà comunque il controllo: questo serve solo a spiegare in UI.
  blockedReason: string | null;
}

// Interruttore dell'emissione automatica del documento commerciale.
export function FiscalToggle({ initialEnabled, blockedReason }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = !enabled && blockedReason !== null;

  async function toggle() {
    if (saving || blocked) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/venue/fiscal", {
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-900">Emissione automatica del documento commerciale</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Per ogni ordine pagato viene trasmesso il documento commerciale
            all&apos;Agenzia delle Entrate tramite il provider configurato. La vendita
            non dipende mai dall&apos;esito fiscale.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={saving || blocked}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-klink-lime" : "bg-zinc-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {blocked && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Attivazione non disponibile: {blockedReason}
        </p>
      )}
      <p className="text-xs text-zinc-500 italic">
        Attivare solo previa conferma del proprio consulente fiscale.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
