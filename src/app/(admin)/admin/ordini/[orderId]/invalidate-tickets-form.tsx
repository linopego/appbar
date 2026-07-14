"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Ticket {
  id: string;
  tierName: string;
  price: string;
}

export function InvalidateTicketsForm({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (tickets.length === 0) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0 || reason.trim().length < 10) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets/invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds: Array.from(selected), reason: reason.trim() }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Errore durante l'invalidazione");
        return;
      }
      setShowModal(false);
      setSelected(new Set());
      setReason("");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <h3 className="font-semibold text-zinc-900">Ticket ACTIVE</h3>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden bg-white">
          {tickets.map((t) => (
            <label key={t.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors ${selected.has(t.id) ? "bg-amber-50" : ""}`}>
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
                className="h-4 w-4 rounded border-zinc-300 text-red-600"
              />
              <span className="flex-1 text-sm font-medium text-zinc-900">{t.tierName}</span>
              <span className="text-sm text-zinc-500">{t.price}</span>
            </label>
          ))}
        </div>

        <button
          onClick={() => setShowModal(true)}
          disabled={selected.size === 0}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Invalida {selected.size > 0 ? `${selected.size} ` : ""}ticket selezionati
        </button>

        <p className="text-xs text-zinc-400">
          ⚠️ L'invalidazione non genera un rimborso automatico su Stripe. Usa la sezione Rimborsi per rimborsare il cliente.
        </p>
      </div>

      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-zinc-900">Invalida {selected.size} ticket</h3>

            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <p className="font-medium">Operazione irreversibile.</p>
              <p>I ticket verranno marcati come REFUNDED (status). Nessun rimborso Stripe verrà emesso automaticamente.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-zinc-900">
                Motivazione <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Specifica il motivo dell'invalidazione (min. 10 caratteri)..."
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
              />
              <p className="text-xs text-zinc-400">{reason.length}/500</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={loading || reason.trim().length < 10}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50 transition-colors"
              >
                {loading ? "Invalidazione…" : "Conferma invalidazione"}
              </button>
              <button
                onClick={() => { setShowModal(false); setError(null); }}
                disabled={loading}
                className="px-4 py-3 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
