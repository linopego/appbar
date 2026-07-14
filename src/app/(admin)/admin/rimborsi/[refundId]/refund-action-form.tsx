"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  refundId: string;
  amount: string;
  ticketCount: number;
}

export function RefundActionForm({ refundId, amount, ticketCount }: Props) {
  const router = useRouter();
  const [managerNote, setManagerNote] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setAction("approve");
    setConfirming(true);
    setError(null);
  };

  const handleReject = () => {
    if (!managerNote.trim() || managerNote.trim().length < 5) {
      setError("Inserisci la motivazione del rifiuto (min. 5 caratteri)");
      return;
    }
    setAction("reject");
    setConfirming(true);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!action) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint = action === "approve"
        ? `/api/admin/refund-requests/${refundId}/approve`
        : `/api/admin/refund-requests/${refundId}/reject`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerNote: managerNote.trim() || undefined }),
      });
      const json = await res.json() as { ok: boolean; error?: string };

      if (!res.ok || !json.ok) {
        setError(typeof json.error === "string" ? json.error : "Errore durante l'operazione. Riprova.");
        setConfirming(false);
        return;
      }

      router.push("/admin/rimborsi");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  if (confirming) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <h3 className="font-semibold text-zinc-900">
          {action === "approve" ? "Conferma approvazione" : "Conferma rifiuto"}
        </h3>

        {action === "approve" ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 space-y-1">
            <p className="font-medium">Stai per processare il rimborso di {amount} per {ticketCount} ticket.</p>
            <p>Questa azione avvierà automaticamente il refund su Stripe e non può essere annullata.</p>
          </div>
        ) : (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800 space-y-1">
            <p className="font-medium">Stai per rifiutare la richiesta di rimborso.</p>
            <p>I ticket rimarranno ACTIVE e utilizzabili. Il cliente riceverà una notifica email.</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 ${
              action === "approve"
                ? "bg-green-600 hover:bg-green-500"
                : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {loading
              ? "Elaborazione..."
              : action === "approve"
                ? `Conferma rimborso di ${amount}`
                : "Conferma rifiuto"}
          </button>
          <button
            onClick={() => { setConfirming(false); setAction(null); }}
            disabled={loading}
            className="px-4 py-3 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium"
          >
            Annulla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
      <h3 className="font-semibold text-zinc-900">Azione</h3>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="managerNote">
          Nota interna{" "}
          <span className="text-zinc-400 font-normal">(obbligatoria per rifiuto, facoltativa per approvazione)</span>
        </label>
        <textarea
          id="managerNote"
          value={managerNote}
          onChange={(e) => setManagerNote(e.target.value)}
          placeholder="Aggiungi una nota interna o motivazione per il cliente..."
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
        >
          ✓ Approva e rimborsa
        </button>
        <button
          onClick={handleReject}
          className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
        >
          ✕ Rifiuta
        </button>
      </div>
    </div>
  );
}
