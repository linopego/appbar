"use client";

import { useState } from "react";

// Pannello "password temporanea": mostrata UNA sola volta, con Copia.
// Usato alla creazione di un Responsabile di locale e nel reset password.
export function TempPasswordPanel({
  tempPassword,
  dark = false,
}: {
  tempPassword: string;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
          type="button"
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
      <p className="text-xs text-zinc-500">Al primo accesso verrà chiesto di cambiarla.</p>
    </div>
  );
}
