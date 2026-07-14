"use client";

import { useState } from "react";

// Imposta/reimposta la password del pannello di un operatore MANAGER.
// La password temporanea è mostrata UNA sola volta. Usato sia nel pannello
// manager (tema chiaro) che nel superadmin (tema scuro): dark prop.
export function OperatorResetPasswordButton({
  endpoint,
  operatorName,
  dark = false,
}: {
  endpoint: string;
  operatorName: string;
  dark?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        `Impostare una nuova password per "${operatorName}"?\n\nQuella attuale (se esiste) smetterà di funzionare. La password temporanea verrà mostrata una sola volta.`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : (data.error?.message ?? "Errore durante il reset.")
        );
        return;
      }
      setTempPassword(data.data.tempPassword as string);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (tempPassword) {
    return (
      <div
        className={`rounded-lg border p-3 space-y-2 text-left ${
          dark ? "border-zinc-700 bg-zinc-950" : "border-amber-300 bg-amber-50"
        }`}
      >
        <p className={`text-xs font-medium ${dark ? "text-amber-400" : "text-amber-700"}`}>
          Password temporanea — salvala ora, non sarà più visibile:
        </p>
        <div className="flex items-center gap-2">
          <code
            className={`flex-1 font-mono text-sm rounded px-2 py-1 break-all select-all ${
              dark ? "bg-zinc-800 text-zinc-100" : "bg-white text-zinc-900 border border-amber-200"
            }`}
          >
            {tempPassword}
          </code>
          <button
            onClick={copy}
            className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
              dark
                ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
                : "bg-zinc-900 hover:bg-zinc-700 text-white"
            }`}
          >
            {copied ? "Copiata!" : "Copia"}
          </button>
        </div>
        <p className={`text-xs ${dark ? "text-zinc-500" : "text-zinc-500"}`}>
          Al primo accesso verrà chiesto di cambiarla.
        </p>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`text-xs px-3 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
          dark
            ? "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            : "border-zinc-200 hover:border-zinc-400 text-zinc-700"
        }`}
      >
        {loading ? "…" : "Imposta/reimposta password"}
      </button>
      {error && <p className="text-xs text-klink-error">{error}</p>}
    </div>
  );
}
