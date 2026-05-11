"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  tierId: string;
  initialName: string;
  initialPrice: string;
  initialSortOrder: number;
}

export function TierEditForm({ tierId, initialName, initialPrice, initialSortOrder }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(initialPrice);
  const [sortOrder, setSortOrder] = useState(String(initialSortOrder));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceChanged = price.trim() !== initialPrice;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/price-tiers/${tierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), price: price.trim(), sortOrder: parseInt(sortOrder, 10) }),
      });
      const json = await res.json() as { ok: boolean; error?: { code?: string; message?: string } };
      if (!res.ok || !json.ok) {
        if (json.error?.code === "NAME_EXISTS") setError(`Una fascia con nome "${name.trim()}" esiste già.`);
        else setError(json.error?.message ?? "Errore durante il salvataggio");
        return;
      }
      router.push("/admin/listino");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900">Nome <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900">Prezzo (€) <span className="text-red-500">*</span></label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          min="0.01"
          max="999.99"
          step="0.01"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
        {priceChanged && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            ⚠️ Modificare il prezzo influenza i ticket attivi non ancora consegnati: il barista vedrà il nuovo prezzo durante la consegna.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900">Ordine visualizzazione</label>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          min="0"
          step="1"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-semibold hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Salvataggio…" : "Salva modifiche"}
        </button>
        <Link href="/admin/listino" className="px-4 py-3 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium">
          Annulla
        </Link>
      </div>
    </form>
  );
}
