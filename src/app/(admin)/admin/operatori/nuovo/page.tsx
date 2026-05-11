"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NuovoOperatorePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"BARISTA" | "CASSIERE" | "MANAGER">("BARISTA");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pin !== pinConfirm) { setError("I PIN non coincidono"); return; }
    if (!/^\d{4,6}$/.test(pin)) { setError("Il PIN deve essere di 4-6 cifre numeriche"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined, role, pin }),
      });
      const json = await res.json() as { ok: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "Errore durante il salvataggio");
        return;
      }
      router.push("/admin/operatori");
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
        <Link href="/admin/operatori" className="text-sm text-zinc-500 hover:text-zinc-800">← Operatori</Link>
        <h1 className="text-2xl font-bold text-zinc-900">Nuovo operatore</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900">Nome <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900">Email <span className="text-zinc-400 font-normal">(opzionale, per notifiche rimborso se Manager)</span></label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900">Ruolo <span className="text-red-500">*</span></label>
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500">
            <option value="BARISTA">Barista</option>
            <option value="CASSIERE">Cassiere</option>
            <option value="MANAGER">Manager</option>
          </select>
          {role === "MANAGER" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ I Manager hanno accesso completo al pannello admin di questo venue.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900">PIN (4-6 cifre) <span className="text-red-500">*</span></label>
          <div className="relative">
            <input type={showPin ? "text" : "password"} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              required minLength={4} maxLength={6} pattern="\d{4,6}" placeholder="••••"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
            <button type="button" onClick={() => setShowPin((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700">
              {showPin ? "Nascondi" : "Mostra"}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900">Conferma PIN <span className="text-red-500">*</span></label>
          <input type={showPin ? "text" : "password"} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
            required minLength={4} maxLength={6} placeholder="••••"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-semibold hover:bg-zinc-700 disabled:opacity-50 transition-colors">
            {loading ? "Salvataggio…" : "Crea operatore"}
          </button>
          <Link href="/admin/operatori" className="px-4 py-3 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium">
            Annulla
          </Link>
        </div>
      </form>
    </div>
  );
}
