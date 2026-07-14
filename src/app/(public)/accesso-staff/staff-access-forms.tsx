"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "banco" | "manager";

export function StaffAccessForms() {
  const [tab, setTab] = useState<Tab>("banco");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-full border bg-card p-1">
        {(
          [
            { key: "banco", label: "Sono al banco" },
            { key: "manager", label: "Sono un manager" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "h-10 rounded-full text-sm font-medium transition-colors",
              tab === key
                ? "bg-klink-lime text-klink-ink"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "banco" ? <VenueCodeForm /> : <ManagerLoginForm />}
    </div>
  );
}

function VenueCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/staff/venue-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          res.status === 429
            ? "Troppi tentativi. Riprova tra qualche minuto."
            : "Codice non valido."
        );
        return;
      }
      router.push(`/staff/${data.data.slug}`);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="space-y-1">
        <label htmlFor="venue-code" className="block text-sm font-medium">
          Codice locale
        </label>
        <input
          id="venue-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="es. nome-del-locale"
          className="w-full h-11 rounded-[10px] border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Te lo fornisce il tuo responsabile.
        </p>
      </div>

      {error && <p className="text-sm text-klink-error">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={loading || !code.trim()}>
        {loading ? "Verifica…" : "Vai al login POS"}
      </Button>
    </form>
  );
}

function ManagerLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/staff/login-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          res.status === 429
            ? "Troppi tentativi. Riprova tra qualche minuto."
            : "Credenziali non valide."
        );
        return;
      }
      router.push(data.redirectTo as string);
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="space-y-1">
        <label htmlFor="manager-email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="manager-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full h-11 rounded-[10px] border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="manager-password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="manager-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full h-11 rounded-[10px] border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-klink-error">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Accesso…" : "Entra nel pannello"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Non hai una password? Chiedila a chi gestisce il tuo locale sulla piattaforma.
      </p>
    </form>
  );
}
