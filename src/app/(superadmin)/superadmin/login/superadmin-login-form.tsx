"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "credentials" | "totp" | "totp-setup";

interface SetupData {
  qrDataUrl: string;
  otpauthUrl: string;
}

export function SuperAdminLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Inserisci email e password.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/superadmin/login/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast.error(data?.error?.message ?? "Errore di accesso.");
          return;
        }
        if (data.requiresTotpSetup) {
          setSetupData({ qrDataUrl: data.qrDataUrl, otpauthUrl: data.otpauthUrl });
          setStep("totp-setup");
        } else if (data.requiresTotp) {
          setStep("totp");
        }
      } catch {
        toast.error("Errore di rete. Riprova.");
      }
    });
  }

  function handleTotpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Inserisci un codice di 6 cifre.");
      return;
    }
    const endpoint =
      step === "totp-setup"
        ? "/api/superadmin/login/totp-verify-setup"
        : "/api/superadmin/login/totp";

    startTransition(async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast.error(data?.error?.message ?? "Codice non valido.");
          setCode("");
          return;
        }
        router.push(data.redirectTo as string);
        router.refresh();
      } catch {
        toast.error("Errore di rete. Riprova.");
      }
    });
  }

  if (step === "credentials") {
    return (
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="bg-zinc-800 border-zinc-700 text-zinc-50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-300">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            className="bg-zinc-800 border-zinc-700 text-zinc-50"
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Verifica…" : "Continua"}
        </Button>
      </form>
    );
  }

  if (step === "totp-setup" && setupData) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-zinc-50">Configura 2FA</h2>
          <p className="text-sm text-zinc-400">
            Scansiona il QR con la tua app authenticator (Google Authenticator,
            1Password, Authy), poi inserisci il codice generato.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="rounded-lg bg-white p-4">
            <Image
              src={setupData.qrDataUrl}
              alt="QR code per setup TOTP"
              width={200}
              height={200}
              unoptimized
            />
          </div>
        </div>
        <details className="text-xs text-zinc-400">
          <summary className="cursor-pointer">Inserimento manuale</summary>
          <code className="mt-2 block break-all rounded bg-zinc-800 p-2 text-zinc-300">
            {setupData.otpauthUrl}
          </code>
        </details>
        <form onSubmit={handleTotpSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="setup-code" className="text-zinc-300">Codice 6 cifre</Label>
            <Input
              id="setup-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={isPending}
              className="bg-zinc-800 border-zinc-700 text-zinc-50 text-center text-2xl tracking-[0.5em]"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Verifica…" : "Conferma e accedi"}
          </Button>
        </form>
      </div>
    );
  }

  // step === "totp"
  return (
    <form onSubmit={handleTotpSubmit} className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold text-zinc-50">Verifica 2FA</h2>
        <p className="text-sm text-zinc-400">
          Inserisci il codice di 6 cifre dalla tua app authenticator.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="totp-code" className="text-zinc-300">Codice</Label>
        <Input
          id="totp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          disabled={isPending}
          className="bg-zinc-800 border-zinc-700 text-zinc-50 text-center text-2xl tracking-[0.5em]"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Verifica…" : "Accedi"}
      </Button>
    </form>
  );
}
