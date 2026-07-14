"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  operatorId: string;
  initialName: string;
  initialEmail: string;
  initialRole: string;
}

export function OperatorEditForm({ operatorId, initialName, initialEmail, initialRole }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState(initialRole);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pin) {
      if (pin !== pinConfirm) { setError("I PIN non coincidono"); return; }
      if (!/^\d{4,6}$/.test(pin)) { setError("Il PIN deve essere di 4-6 cifre"); return; }
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), email: email.trim() || null, role };
      if (pin) body.pin = pin;

      const res = await fetch(`/api/admin/operators/${operatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900">Nome <span className="text-red-500">*</span></label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900">Ruolo <span className="text-red-500">*</span></label>
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500">
          <option value="BARISTA">Barista</option>
          <option value="CASSIERE">Cassiere</option>
          <option value="MANAGER">Manager</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900">Nuovo PIN <span className="text-zinc-400 font-normal">(lascia vuoto per non cambiarlo)</span></label>
        <div className="relative">
          <input type={showPin ? "text" : "password"} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            minLength={4} maxLength={6} placeholder="••••"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
          <button type="button" onClick={() => setShowPin((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700">
            {showPin ? "Nascondi" : "Mostra"}
          </button>
        </div>
      </div>

      {pin && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-900">Conferma nuovo PIN</label>
          <input type={showPin ? "text" : "password"} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
            minLength={4} maxLength={6} placeholder="••••"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-semibold hover:bg-zinc-700 disabled:opacity-50 transition-colors">
          {loading ? "Salvataggio…" : "Salva modifiche"}
        </button>
        <Link href="/admin/operatori" className="px-4 py-3 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium">
          Annulla
        </Link>
      </div>
    </form>
  );
}
