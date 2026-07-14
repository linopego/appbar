"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TIMEZONES = [
  "Europe/Rome",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Lisbon",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Budapest",
  "Europe/Vienna",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

interface Props {
  venueId: string;
  initialName: string;
  initialSlug: string;
  initialTimezone: string;
}

export function VenueEditForm({
  venueId,
  initialName,
  initialSlug,
  initialTimezone,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      const res = await fetch(`/api/superadmin/venues/${venueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug, timezone }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string | { code?: string };
      };

      if (res.status === 409) {
        setFieldErrors({ slug: "Questo slug è già in uso." });
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

      router.push(`/superadmin/venues/${venueId}`);
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
          onChange={(e) =>
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          required
          maxLength={80}
          className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
        {slug !== initialSlug && (
          <p className="text-xs text-amber-400 bg-amber-900/30 border border-amber-800 rounded-lg px-3 py-2">
            Attenzione: cambiare lo slug modifica l&apos;URL pubblico del venue.
            I link precedenti smetteranno di funzionare.
          </p>
        )}
        {fieldErrors.slug && (
          <p className="text-xs text-red-400">{fieldErrors.slug}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-200">
          Timezone
        </label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
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
          {loading ? "Salvataggio…" : "Salva modifiche"}
        </button>
        <Link
          href={`/superadmin/venues/${venueId}`}
          className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 font-medium"
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
