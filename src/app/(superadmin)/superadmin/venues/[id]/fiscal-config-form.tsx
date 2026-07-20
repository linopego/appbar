"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  venueId: string;
  initialFiscalId: string;
  initialConfigurationId: string;
  hasSecrets: boolean;
}

// Form PLATFORM per la configurazione fiscale dell'esercente. I segreti si
// scrivono soltanto: vengono cifrati server-side e non sono mai rileggibili.
export function FiscalConfigForm({ venueId, initialFiscalId, initialConfigurationId, hasSecrets }: Props) {
  const router = useRouter();
  const [fiscalId, setFiscalId] = useState(initialFiscalId);
  const [configurationId, setConfigurationId] = useState(initialConfigurationId);
  const [secretsJson, setSecretsJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    let secrets: Record<string, unknown> | undefined;
    if (secretsJson.trim() !== "") {
      try {
        const parsed: unknown = JSON.parse(secretsJson);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
        secrets = parsed as Record<string, unknown>;
      } catch {
        setError("I segreti devono essere un oggetto JSON valido, es. {\"password\": \"...\"}");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/venues/${venueId}/fiscal-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscalId: fiscalId.trim(),
          configurationId: configurationId.trim() || null,
          ...(secrets !== undefined ? { secrets } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nel salvataggio.");
        return;
      }
      setSaved(true);
      setSecretsJson("");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="block text-xs text-zinc-400">
          Identificativo fiscale esercente (P.IVA) <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={fiscalId}
          onChange={(e) => setFiscalId(e.target.value)}
          required
          placeholder="es. 12345678901"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-mono"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-zinc-400">ID configurazione presso il provider</label>
        <input
          type="text"
          value={configurationId}
          onChange={(e) => setConfigurationId(e.target.value)}
          placeholder="facoltativo"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-mono"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-zinc-400">
          Segreti esercente (JSON) — {hasSecrets ? "presenti, cifrati" : "assenti"}
        </label>
        <textarea
          value={secretsJson}
          onChange={(e) => setSecretsJson(e.target.value)}
          rows={3}
          placeholder={hasSecrets ? "Lascia vuoto per conservare i segreti attuali" : '{"password": "..."}'}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-mono"
        />
        <p className="text-xs text-zinc-500">
          Salvati solo cifrati (AES-256-GCM), mai rileggibili da qui. Vuoto = conserva gli
          attuali; <code>{"{}"}</code> = rimuovili.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">Configurazione salvata.</p>}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {saving ? "Salvataggio…" : "Salva configurazione fiscale"}
      </button>
    </form>
  );
}
