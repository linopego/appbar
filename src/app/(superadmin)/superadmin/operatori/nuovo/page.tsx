"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TempPasswordPanel } from "@/components/shared/temp-password-panel";

interface Venue {
  id: string;
  name: string;
}

export default function NuovoOperatorePageSuperAdmin() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [venueId, setVenueId] = useState("");
  const [role, setRole] = useState<"BARISTA" | "CASSIERE" | "MANAGER">("BARISTA");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Responsabile creato: password temporanea mostrata UNA volta
  const [managerPassword, setManagerPassword] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/superadmin/venues")
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: Venue[] }) => {
        if (j.ok && j.data) setVenues(j.data);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pin !== pinConfirm) {
      setError("I PIN non coincidono");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError("Il PIN deve essere di 4-6 cifre numeriche");
      return;
    }
    if (!venueId) {
      setError("Seleziona un venue");
      return;
    }
    if (role === "MANAGER" && !email.trim()) {
      setError("Il Responsabile di locale ha bisogno di un'email per accedere al pannello");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          venueId,
          role,
          pin,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { id: string };
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

      // Responsabile di locale: genera SUBITO la password del pannello
      // (riusa il meccanismo di reset: mustChangePassword attivo)
      if (role === "MANAGER" && json.data?.id) {
        const resetRes = await fetch(`/api/superadmin/operators/${json.data.id}/reset-password`, {
          method: "POST",
        });
        const resetJson = (await resetRes.json()) as { ok: boolean; data?: { tempPassword: string } };
        if (resetRes.ok && resetJson.ok && resetJson.data?.tempPassword) {
          setManagerPassword(resetJson.data.tempPassword);
          return;
        }
        setError("Operatore creato, ma la password non è stata generata: usa «Imposta/reimposta password» dalla pagina di modifica.");
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

  // Responsabile creato: la password temporanea si vede SOLO ora
  if (managerPassword) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
        <div className="mx-auto max-w-lg space-y-6">
          <h1 className="text-2xl font-semibold">Responsabile di locale creato</h1>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <p className="text-sm text-zinc-300">
              <strong>{name}</strong> può accedere al pannello da <strong>Area staff →
              Responsabile di locale</strong> con la sua email e questa password temporanea:
            </p>
            <TempPasswordPanel tempPassword={managerPassword} dark />
          </div>
          <button
            onClick={() => { router.push("/superadmin/operatori"); router.refresh(); }}
            className="w-full py-3 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white font-semibold transition-colors"
          >
            Fatto, vai agli operatori
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-1">
          <Link
            href="/superadmin/operatori"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Operatori
          </Link>
          <h1 className="text-2xl font-semibold">Nuovo operatore</h1>
        </div>

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
            <label className="block text-sm font-medium text-zinc-200">
              Email{" "}
              <span className="text-zinc-400 font-normal">(opzionale)</span>
            </label>
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
              Venue <span className="text-red-500">*</span>
            </label>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              required
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">— Seleziona venue —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-200">
              Ruolo <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="BARISTA">Barista</option>
              <option value="CASSIERE">Cassiere</option>
              <option value="MANAGER">Responsabile di locale</option>
            </select>
            {role === "MANAGER" && (
              <div className="text-xs text-amber-400/90 bg-amber-900/20 border border-amber-900/40 rounded-lg px-3 py-2 space-y-1 mt-1">
                <p className="font-semibold">Accesso al pannello</p>
                <p>
                  Il Responsabile di locale ha accesso completo al pannello del venue. Alla
                  creazione verrà generata subito una password temporanea del pannello:
                  sarà mostrata una sola volta.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-200">
              PIN (4-6 cifre) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                required
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

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-200">
              Conferma PIN <span className="text-red-500">*</span>
            </label>
            <input
              type={showPin ? "text" : "password"}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
              required
              minLength={4}
              maxLength={6}
              placeholder="••••"
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
              {loading ? "Creazione…" : "Crea operatore"}
            </button>
            <Link
              href="/superadmin/operatori"
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
