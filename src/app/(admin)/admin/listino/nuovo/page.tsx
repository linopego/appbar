"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NuovaFasciaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/price-tiers", {
        method: "POST",
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
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        <Link href="/admin/listino" className="text-sm text-zinc-500 hover:text-zinc-800">← Listino</Link>
        <h1 className="text-2xl font-bold text-zinc-900">Nuova fascia</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900">Nome <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Acqua, Birra, Drink"
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
            placeholder="0.00"
            required
            min="0.01"
            max="999.99"
            step="0.01"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
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
          <p className="text-xs text-zinc-400">Valori più bassi appaiono prima (default 100)</p>
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
            {loading ? "Salvataggio…" : "Crea fascia"}
          </button>
          <Link href="/admin/listino" className="px-4 py-3 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium">
            Annulla
          </Link>
        </div>
      </form>
    </div>
  );
}
