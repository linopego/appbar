"use client";

import { useState } from "react";
import Link from "next/link";

export default function NuovoAdminUserPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { temporaryPassword?: string };
        error?: string | { message?: string };
      };

      if (!res.ok || !json.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : json.error?.message ?? "Errore durante la creazione";
        setError(msg);
        return;
      }

      setGeneratedPassword(json.data?.temporaryPassword ?? "");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (generatedPassword !== null) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="space-y-1">
            <Link
              href="/superadmin/admin-users"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ← Admin Users
            </Link>
            <h1 className="text-2xl font-semibold">Admin creato</h1>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <div className="rounded-lg bg-amber-900/30 border border-amber-700 px-4 py-3">
              <p className="text-amber-300 text-sm font-medium">
                Salva questa password subito — non sarà più visibile.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-zinc-400 uppercase tracking-wide">
                Password temporanea
              </p>
              <div className="flex items-center gap-3">
                <code className="flex-1 font-mono text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 break-all select-all">
                  {generatedPassword}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm transition-colors"
                >
                  {copied ? "Copiato!" : "Copia"}
                </button>
              </div>
            </div>

            <p className="text-sm text-zinc-400">
              L&apos;utente dovrà cambiare la password al primo accesso.
            </p>

            <Link
              href="/superadmin/admin-users"
              className="inline-block mt-2 text-zinc-300 hover:text-zinc-50 underline text-sm"
            >
              ← Torna alla lista
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-1">
          <Link
            href="/superadmin/admin-users"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Admin Users
          </Link>
          <h1 className="text-2xl font-semibold">Nuovo admin</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-200">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              placeholder="admin@example.com"
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>

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
              placeholder="Mario Rossi"
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>

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
              {loading ? "Creazione…" : "Crea admin"}
            </button>
            <Link
              href="/superadmin/admin-users"
              className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 font-medium"
            >
              Annulla
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
