"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bottone "Riprova" per un documento fiscale PENDING/FAILED: chiama
// l'endpoint di retry (manager o superadmin) e ricarica la pagina.
export function FiscalRetryButton({
  endpoint,
  theme = "light",
}: {
  endpoint: string;
  theme?: "light" | "dark";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nel nuovo tentativo.");
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
        onClick={retry}
        disabled={loading}
        className={
          theme === "dark"
            ? "text-xs px-3 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors disabled:opacity-50"
            : "text-xs px-3 py-1 rounded-lg border border-zinc-200 hover:border-zinc-400 text-zinc-700 transition-colors disabled:opacity-50"
        }
      >
        {loading ? "Nuovo tentativo…" : "Riprova"}
      </button>
      {error && (
        <p className={theme === "dark" ? "text-xs text-red-400" : "text-xs text-red-600"}>{error}</p>
      )}
    </div>
  );
}
