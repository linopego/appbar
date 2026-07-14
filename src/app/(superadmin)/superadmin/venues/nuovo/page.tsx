"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function NuovoVenuePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [withDefaults, setWithDefaults] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleNameChange(v: string) {
    setName(v);
    if (!slugManual) {
      setSlug(toSlug(v));
    }
  }

  function handleSlugChange(v: string) {
    setSlugManual(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Il nome è obbligatorio";
    if (!slug.trim()) errs.slug = "Lo slug è obbligatorio";
    else if (!/^[a-z0-9-]+$/.test(slug))
      errs.slug = "Solo lettere minuscole, numeri e trattini";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug, withDefaults }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string | { code?: string };
      };

      if (res.status === 409) {
        setFieldErrors({ slug: "Questo slug è già in uso. Scegline un altro." });
        return;
      }
      if (!res.ok || !json.ok) {
        setError(
          typeof json.error === "string"
            ? json.error
            : "Errore durante il salvataggio"
        );
        return;
      }

      router.push("/superadmin/venues");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-1">
          <Link
            href="/superadmin/venues"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Venue
          </Link>
          <h1 className="text-2xl font-semibold">Nuovo venue</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-200">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              maxLength={100}
              placeholder="Bar Roma Centro"
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-400">{fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-200">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              required
              maxLength={80}
              placeholder="bar-roma-centro"
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
            <p className="text-xs text-zinc-500">
              Usato nell&apos;URL pubblico. Solo minuscole, numeri e trattini.
            </p>
            {fieldErrors.slug && (
              <p className="text-xs text-red-400">{fieldErrors.slug}</p>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={withDefaults}
              onChange={(e) => setWithDefaults(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-zinc-100 accent-zinc-400"
            />
            <span className="text-sm text-zinc-200">
              Crea con listino default{" "}
              <span className="text-zinc-400 font-normal">
                (Acqua, Analcolico, Birra, Red Bull, Drink, Drink Premium)
              </span>
            </span>
          </label>

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
              {loading ? "Creazione…" : "Crea venue"}
            </button>
            <Link
              href="/superadmin/venues"
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
