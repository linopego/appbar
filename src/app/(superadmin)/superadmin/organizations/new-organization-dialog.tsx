"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewOrganizationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [feePercent, setFeePercent] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/superadmin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), feePercent: feePercent.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nella creazione.");
        return;
      }
      setOpen(false);
      setName("");
      setFeePercent("0");
      router.push(`/superadmin/organizations/${data.data.id}`);
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
      >
        + Nuova organizzazione
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Nuova organizzazione</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Il cliente della piattaforma: possiede venue, operatori e admin propri.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="org-name" className="block text-sm text-zinc-300 mb-1">
                  Nome
                </label>
                <input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Es. Rossi Eventi srl"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label htmlFor="org-fee" className="block text-sm text-zinc-300 mb-1">
                  Fee piattaforma (%)
                </label>
                <input
                  id="org-fee"
                  value={feePercent}
                  onChange={(e) => setFeePercent(e.target.value)}
                  required
                  inputMode="decimal"
                  placeholder="Es. 5 oppure 2.50"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Da 0 a 50, massimo due decimali. Vale solo per gli ordini futuri.
                </p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? "Creazione…" : "Crea organizzazione"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
