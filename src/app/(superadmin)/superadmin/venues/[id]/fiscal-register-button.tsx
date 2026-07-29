"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Censimento esplicito dell'esercente presso il provider fiscale (PLATFORM).
export function FiscalRegisterButton({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/venues/${venueId}/fiscal-register`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nella registrazione.");
        return;
      }
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={register}
        disabled={loading}
        className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? "Registrazione…" : "Registra esercente presso il provider"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
