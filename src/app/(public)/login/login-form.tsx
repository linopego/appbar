"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { loginSchema } from "@/lib/validators/auth";

type Mode = "login" | "register";

interface LoginFormProps {
  mode?: Mode;
  callbackUrl?: string;
}

const COPY: Record<Mode, { submit: string; loading: string }> = {
  login: { submit: "Invia link di accesso", loading: "Invio in corso…" },
  register: { submit: "Crea account", loading: "Creazione in corso…" },
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29 35.5 26.6 36.5 24 36.5c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.4 39.7 16.1 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.6l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export function LoginForm({ mode = "login", callbackUrl = "/profilo" }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isEmailPending, startEmailTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();

  const submitting = isEmailPending || isGooglePending;
  const copy = COPY[mode];

  function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailError(null);

    const result = loginSchema.safeParse({ email });
    if (!result.success) {
      const issue = result.error.issues[0];
      const message = issue?.message ?? "Email non valida";
      setEmailError(message);
      toast.error(message);
      return;
    }

    startEmailTransition(async () => {
      try {
        const res = await signIn("resend", {
          email: result.data.email,
          redirect: false,
          redirectTo: callbackUrl,
        });
        if (res?.error) {
          toast.error("Errore nell'invio dell'email. Riprova.");
          return;
        }
        window.location.href = "/login/verifica-email";
      } catch {
        toast.error("Errore di rete. Riprova.");
      }
    });
  }

  function handleGoogleClick() {
    startGoogleTransition(async () => {
      try {
        await signIn("google", { redirectTo: callbackUrl });
      } catch {
        toast.error("Errore nell'accesso con Google. Riprova.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleEmailSubmit} className="space-y-3" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@esempio.it"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
          />
          {emailError ? (
            <p id="email-error" className="text-xs text-destructive">
              {emailError}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {isEmailPending ? copy.loading : copy.submit}
        </Button>
      </form>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
          oppure
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleClick}
        disabled={submitting}
      >
        <GoogleIcon />
        Accedi con Google
      </Button>
    </div>
  );
}
