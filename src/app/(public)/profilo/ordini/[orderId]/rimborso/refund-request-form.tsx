"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEur } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

interface RefundableTicket {
  id: string;
  tierName: string;
  price: string;
  qrToken: string;
}

interface NonRefundableTicket {
  id: string;
  tierName: string;
  price: string;
  reason: "CONSUMED" | "EXPIRED" | "REFUNDED" | "IN_PENDING_REFUND";
}

interface Props {
  orderId: string;
  eligible: boolean;
  blockedByTime: boolean;
  nextUnblockedTime: string | null;
  venueTimezone: string;
  refundableTickets: RefundableTicket[];
  nonRefundableTickets: NonRefundableTicket[];
}

const REASON_LABELS: Record<NonRefundableTicket["reason"], string> = {
  CONSUMED: "Già consegnato",
  EXPIRED: "Scaduto",
  REFUNDED: "Già rimborsato",
  IN_PENDING_REFUND: "Rimborso in corso",
};

export function RefundRequestForm({
  orderId,
  eligible,
  blockedByTime,
  nextUnblockedTime,
  refundableTickets,
  nonRefundableTickets,
}: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(refundableTickets.map((t) => t.id))
  );
  const [customerNote, setCustomerNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (blockedByTime) {
    const nextFormatted = nextUnblockedTime
      ? new Intl.DateTimeFormat("it-IT", {
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Rome",
        }).format(new Date(nextUnblockedTime))
      : null;

    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 text-center space-y-3">
        <p className="text-2xl">🕐</p>
        <p className="font-semibold text-yellow-900">Rimborsi non disponibili ora</p>
        <p className="text-sm text-yellow-800">
          {nextFormatted
            ? `I rimborsi riaprono ${nextFormatted}.`
            : "I rimborsi non sono disponibili in questo momento."}
        </p>
      </div>
    );
  }

  if (!eligible || refundableTickets.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center space-y-2">
        <p className="font-semibold text-zinc-700">Nessun ticket rimborsabile</p>
        <p className="text-sm text-zinc-500">
          Tutti i ticket di questo ordine sono già stati consegnati, rimborsati o scaduti.
        </p>
      </div>
    );
  }

  const selectedTickets = refundableTickets.filter((t) => selectedIds.has(t.id));
  const totalAmount = selectedTickets.reduce((sum, t) => sum + Number(t.price), 0);

  const toggleTicket = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(refundableTickets.map((t) => t.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedIds.size === 0) {
      setError("Seleziona almeno un ticket da rimborsare");
      return;
    }
    if (customerNote.trim().length < 10) {
      setError("Inserisci una motivazione di almeno 10 caratteri");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/refund-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketIds: Array.from(selectedIds),
          customerNote: customerNote.trim(),
        }),
      });
      const json = await res.json() as { ok: boolean; data?: { refundId: string }; error?: { code?: string; message?: string } };

      if (!res.ok || !json.ok) {
        const code = json.error?.code;
        if (code === "REFUND_BLOCKED_BY_TIME") {
          setError("I rimborsi non sono disponibili in questo momento. Riprova più tardi.");
        } else if (code === "TICKETS_NOT_REFUNDABLE") {
          setError("Alcuni ticket selezionati non sono rimborsabili. Aggiorna la pagina e riprova.");
        } else if (code === "TICKETS_ALREADY_IN_REFUND") {
          setError("Esiste già una richiesta di rimborso per uno o più ticket selezionati.");
        } else {
          setError(json.error?.message ?? "Errore durante l'invio. Riprova.");
        }
        return;
      }

      router.push(`/profilo/rimborsi/${json.data!.refundId}`);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selectable tickets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Seleziona i ticket da rimborsare</h2>
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={selectAll} className="text-zinc-500 hover:text-zinc-800 underline">
              Tutti
            </button>
            <button type="button" onClick={deselectAll} className="text-zinc-500 hover:text-zinc-800 underline">
              Nessuno
            </button>
          </div>
        </div>

        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
          {refundableTickets.map((ticket) => {
            const checked = selectedIds.has(ticket.id);
            return (
              <label
                key={ticket.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors",
                  checked && "bg-green-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTicket(ticket.id)}
                  className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
                />
                <span className="flex-1 font-medium text-zinc-900">{ticket.tierName}</span>
                <span className="text-zinc-500">{formatEur(ticket.price)}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Non-refundable tickets (informative) */}
      {nonRefundableTickets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-500">Ticket non rimborsabili</h3>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-100 overflow-hidden">
            {nonRefundableTickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center gap-3 px-4 py-3 opacity-50">
                <div className="h-4 w-4 rounded border border-zinc-300 bg-zinc-100 shrink-0" />
                <span className="flex-1 text-sm text-zinc-500">{ticket.tierName}</span>
                <span className="text-sm text-zinc-400">{REASON_LABELS[ticket.reason]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-900" htmlFor="customerNote">
          Motivazione <span className="text-red-500">*</span>
        </label>
        <textarea
          id="customerNote"
          value={customerNote}
          onChange={(e) => setCustomerNote(e.target.value)}
          placeholder="Spiega perché vuoi richiedere il rimborso (min. 10 caratteri)"
          rows={4}
          maxLength={500}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
        />
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{customerNote.length < 10 ? `${10 - customerNote.length} caratteri ancora` : "✓"}</span>
          <span>{customerNote.length}/500</span>
        </div>
      </div>

      {/* Summary */}
      {selectedTickets.length > 0 && (
        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Ticket selezionati</span>
            <span className="font-medium">{selectedTickets.length}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Totale rimborso</span>
            <span className="text-green-700">{formatEur(totalAmount.toFixed(2))}</span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || selectedIds.size === 0}
        className="w-full py-3 rounded-xl bg-zinc-900 text-white font-semibold hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Invio in corso..." : "Invia richiesta di rimborso"}
      </button>
    </form>
  );
}
