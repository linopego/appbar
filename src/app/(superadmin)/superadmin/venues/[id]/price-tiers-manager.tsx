"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Gestione del listino dal pannello superadmin (PLATFORM e ORG_ADMIN, lo
// scoping è lato API). Le fasce non si eliminano mai: solo disattivazione.
// Modificare una fascia non tocca i ticket già venduti (snapshot su
// OrderItem/FiscalDocument): vale solo per gli acquisti futuri.

export interface TierRow {
  id: string;
  name: string;
  price: string;
  vatRate: string | null; // null = IVA non impostata
  sortOrder: number;
  active: boolean;
}

interface DialogState {
  mode: "create" | "edit";
  tier?: TierRow;
}

// Formatter locale: @/lib/utils/money importa @prisma/client, che non deve
// finire nel bundle client
function formatEur(value: string): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    Number(value)
  );
}

export function PriceTiersManager({ venueId, tiers }: { venueId: string; tiers: TierRow[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [rowError, setRowError] = useState<{ tierId: string; message: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleActive(tier: TierRow) {
    const verb = tier.active ? "Disattivare" : "Riattivare";
    if (!window.confirm(`${verb} la fascia "${tier.name}"?`)) return;
    setTogglingId(tier.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/superadmin/price-tiers/${tier.id}/toggle-active`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setRowError({
          tierId: tier.id,
          message: typeof data.error === "string" ? data.error : "Errore nel salvataggio.",
        });
        return;
      }
      router.refresh();
    } catch {
      setRowError({ tierId: tier.id, message: "Errore di rete. Riprova." });
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">Listino ({tiers.length} fasce)</h2>
        <button
          onClick={() => setDialog({ mode: "create" })}
          className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors"
        >
          + Nuova fascia
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-right px-4 py-3">Prezzo</th>
              <th className="text-right px-4 py-3">IVA</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">Ordine</th>
              <th className="text-left px-4 py-3">Stato</th>
              <th className="text-right px-4 py-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr
                key={tier.id}
                className={`border-b border-zinc-800/50 transition-colors ${tier.active ? "" : "opacity-50"}`}
              >
                <td className="px-4 py-3 text-zinc-100">
                  <span className="inline-flex items-center gap-2">
                    {tier.name}
                    {tier.active && tier.vatRate === null && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400">
                        IVA mancante
                      </span>
                    )}
                  </span>
                  {rowError?.tierId === tier.id && (
                    <p className="text-xs text-red-400 mt-1">{rowError.message}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                  {formatEur(tier.price)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                  {tier.vatRate !== null ? `${tier.vatRate}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-500 hidden sm:table-cell">
                  {tier.sortOrder}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      tier.active ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {tier.active ? "Attivo" : "Inattivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => {
                        setRowError(null);
                        setDialog({ mode: "edit", tier });
                      }}
                      className="text-xs px-3 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => toggleActive(tier)}
                      disabled={togglingId === tier.id}
                      className="text-xs px-3 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors disabled:opacity-50"
                    >
                      {tier.active ? "Disattiva" : "Riattiva"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Nessuna fascia prezzo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Le fasce non si eliminano (lo storico ordini le referenzia): usa Disattiva. Modificare
        una fascia non tocca i ticket già venduti, vale solo per gli acquisti futuri.
      </p>

      {dialog && (
        <TierDialog
          venueId={venueId}
          mode={dialog.mode}
          tier={dialog.tier ?? null}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function TierDialog({
  venueId,
  mode,
  tier,
  onClose,
}: {
  venueId: string;
  mode: "create" | "edit";
  tier: TierRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(tier?.name ?? "");
  const [price, setPrice] = useState(tier?.price ?? "");
  const [vatRate, setVatRate] = useState(tier?.vatRate ?? "");
  const [sortOrder, setSortOrder] = useState(String(tier?.sortOrder ?? 100));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        price: price.trim(),
        sortOrder: parseInt(sortOrder, 10),
        vatRate: vatRate.trim() === "" ? null : vatRate.trim(),
      };
      const res = await fetch(
        mode === "create"
          ? `/api/superadmin/venues/${venueId}/price-tiers`
          : `/api/superadmin/price-tiers/${tier?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error?.code === "NAME_EXISTS") {
          setError(`Una fascia con nome "${name.trim()}" esiste già in questo venue.`);
        } else {
          setError(typeof data.error === "string" ? data.error : "Errore nel salvataggio.");
        }
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-zinc-50">
          {mode === "create" ? "Nuova fascia" : `Modifica "${tier?.name}"`}
        </h2>
        {mode === "edit" && (
          <p className="text-sm text-zinc-400 mt-1">
            La modifica vale solo per gli acquisti futuri: i ticket già venduti restano
            invariati.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="tier-name" className="block text-sm text-zinc-300 mb-1">
              Nome
            </label>
            <input
              id="tier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="es. Acqua, Birra, Drink"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="tier-price" className="block text-sm text-zinc-300 mb-1">
              Prezzo (€)
            </label>
            <input
              id="tier-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              min="0.01"
              max="999.99"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="tier-vat" className="block text-sm text-zinc-300 mb-1">
              Aliquota IVA (%)
            </label>
            <input
              id="tier-vat"
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              min="0"
              max="99.99"
              step="0.01"
              placeholder="es. 10 o 22"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Obbligatoria su tutte le fasce attive per attivare il modulo fiscale.
            </p>
          </div>
          <div>
            <label htmlFor="tier-sort" className="block text-sm text-zinc-300 mb-1">
              Ordine visualizzazione
            </label>
            <input
              id="tier-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              min="0"
              step="1"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 text-sm transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Salvataggio…" : mode === "create" ? "Crea fascia" : "Salva modifiche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
