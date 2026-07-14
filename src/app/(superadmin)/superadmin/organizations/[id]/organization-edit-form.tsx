"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrganizationEditForm({
  organizationId,
  initialName,
  initialFeePercent,
}: {
  organizationId: string;
  initialName: string;
  initialFeePercent: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [feePercent, setFeePercent] = useState(initialFeePercent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== initialName || feePercent.trim() !== initialFeePercent;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      feePercent.trim() !== initialFeePercent &&
      !confirm(
        `Confermi la modifica della fee da ${initialFeePercent}% a ${feePercent.trim()}%?\n\nVale solo per gli ordini futuri: gli ordini già emessi mantengono la fee originale.`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/superadmin/organizations/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), feePercent: feePercent.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nel salvataggio.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="edit-name" className="block text-sm text-zinc-300 mb-1">
            Nome
          </label>
          <input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label htmlFor="edit-fee" className="block text-sm text-zinc-300 mb-1">
            Fee piattaforma (%)
          </label>
          <input
            id="edit-fee"
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
            required
            inputMode="decimal"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <p className="text-xs text-zinc-500 mt-1">
            0–50, max due decimali. La modifica vale solo per gli ordini futuri.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && !dirty && <p className="text-sm text-green-400">Salvato.</p>}

      <button
        type="submit"
        disabled={loading || !dirty || !name.trim()}
        className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? "Salvataggio…" : "Salva modifiche"}
      </button>
    </form>
  );
}
