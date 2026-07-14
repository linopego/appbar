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

export function SuperAdminOperatorEditForm({
  operatorId,
  initialName,
  initialEmail,
  initialRole,
}: Props) {
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
      if (pin !== pinConfirm) {
        setError("I PIN non coincidono");
        return;
      }
      if (!/^\d{4,6}$/.test(pin)) {
        setError("Il PIN deve essere di 4-6 cifre");
        return;
      }
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim() || null,
        role,
      };
      if (pin) body.pin = pin;

      const res = await fetch(`/api/superadmin/operators/${operatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string | { message?: string };
      };
      if (!res.ok || !json.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : json.error?.message ?? "Errore durante il salvataggio";
        setError(msg);
        return;
      }
      router.push("/superadmin/operatori");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-200">
          Nome <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-200">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-200">
          Ruolo <span className="text-red-500">*</span>
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          <option value="BARISTA">Barista</option>
          <option value="CASSIERE">Cassiere</option>
          <option value="MANAGER">Manager</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-200">
          Nuovo PIN{" "}
          <span className="text-zinc-400 font-normal">
            (lascia vuoto per non cambiarlo)
          </span>
        </label>
        <div className="relative">
          <input
            type={showPin ? "text" : "password"}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            minLength={4}
            maxLength={6}
            placeholder="••••"
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
          <button
            type="button"
            onClick={() => setShowPin((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            {showPin ? "Nascondi" : "Mostra"}
          </button>
        </div>
      </div>

      {pin && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-200">
            Conferma nuovo PIN
          </label>
          <input
            type={showPin ? "text" : "password"}
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
            minLength={4}
            maxLength={6}
            placeholder="••••"
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white font-semibold disabled:opacity-50 transition-colors"
        >
          {loading ? "Salvataggio…" : "Salva modifiche"}
        </button>
        <Link
          href="/superadmin/operatori"
          className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 font-medium"
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
