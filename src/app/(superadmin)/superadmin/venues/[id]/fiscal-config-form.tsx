"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  venueId: string;
  initialFiscalId: string;
  initialName: string;
  // Suggerimento per la denominazione (nome dell'organizzazione)
  suggestedName: string;
  initialEmail: string;
  initialAddress: string;
  initialCity: string;
  initialProvince: string;
  initialZip: string;
  initialConfigurationId: string;
  hasSecrets: boolean;
}

// Form PLATFORM per la configurazione fiscale dell'esercente: anagrafica per
// il censimento presso il provider (in chiaro nel Json) + segreti write-only
// (cifrati server-side, mai rileggibili).
export function FiscalConfigForm({
  venueId,
  initialFiscalId,
  initialName,
  suggestedName,
  initialEmail,
  initialAddress,
  initialCity,
  initialProvince,
  initialZip,
  initialConfigurationId,
  hasSecrets,
}: Props) {
  const router = useRouter();
  const [fiscalId, setFiscalId] = useState(initialFiscalId);
  const [name, setName] = useState(initialName || suggestedName);
  const [email, setEmail] = useState(initialEmail);
  const [address, setAddress] = useState(initialAddress);
  const [city, setCity] = useState(initialCity);
  const [province, setProvince] = useState(initialProvince);
  const [zip, setZip] = useState(initialZip);
  const [configurationId, setConfigurationId] = useState(initialConfigurationId);
  const [secretsJson, setSecretsJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500";

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
          name: name.trim(),
          email: email.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          province: province.trim() || null,
          zip: zip.trim() || null,
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
      <div className="grid sm:grid-cols-2 gap-3">
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
            className={`${inputClass} font-mono`}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">
            Denominazione esercente <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder={suggestedName || "es. Rossi Eventi srl"}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="facoltativa"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Indirizzo</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="facoltativo"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Città</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="facoltativa"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">Provincia</label>
            <input
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="es. MI"
              maxLength={2}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-400">CAP</label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="es. 20100"
              maxLength={5}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-zinc-400">ID configurazione presso il provider</label>
        <input
          type="text"
          value={configurationId}
          onChange={(e) => setConfigurationId(e.target.value)}
          placeholder="compilato dalla registrazione"
          className={`${inputClass} font-mono`}
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
          placeholder={hasSecrets ? "Lascia vuoto per conservare i segreti attuali" : '{"username": "...", "password": "...", "pin": "..."}'}
          className={`${inputClass} font-mono`}
        />
        <p className="text-xs text-zinc-500">
          Credenziali Fisconline dell&apos;esercente, salvate solo cifrate (AES-256-GCM), mai
          rileggibili da qui. Vuoto = conserva gli attuali; <code>{"{}"}</code> = rimuovili.
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
