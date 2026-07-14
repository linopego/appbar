"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le due password non coincidono.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nel salvataggio.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="space-y-1">
        <label htmlFor="new-password" className="block text-sm font-medium text-zinc-700">
          Nuova password
        </label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-[10px] border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
        <p className="text-xs text-zinc-400">Minimo 8 caratteri.</p>
      </div>
      <div className="space-y-1">
        <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-700">
          Ripeti password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-[10px] border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </div>

      {error && <p className="text-sm text-klink-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-full bg-klink-lime text-klink-ink font-semibold hover:bg-klink-lime-hover transition-colors disabled:opacity-50"
      >
        {loading ? "Salvataggio…" : "Salva e continua"}
      </button>
    </form>
  );
}
