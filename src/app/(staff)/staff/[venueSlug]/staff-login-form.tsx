"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_LABELS: Record<string, string> = {
  BARISTA: "Barista",
  CASSIERE: "Cassiere",
  MANAGER: "Manager",
};

interface Operator {
  id: string;
  name: string;
  role: "BARISTA" | "CASSIERE" | "MANAGER";
}

interface StaffLoginFormProps {
  venueSlug: string;
  venueName: string;
  operators: Operator[];
}

const PIN_LENGTH = 6;

export function StaffLoginForm({ venueSlug, venueName, operators }: StaffLoginFormProps) {
  const router = useRouter();
  const [operatorId, setOperatorId] = useState<string>("");
  const [pinDigits, setPinDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (operatorId) inputRefs.current[0]?.focus();
  }, [operatorId]);

  function handleDigitChange(index: number, value: string) {
    const sanitized = value.replace(/\D/g, "").slice(-1);
    setPinDigits((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });
    if (sanitized && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(PIN_LENGTH).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i] ?? "";
    setPinDigits(next);
    const focusIndex = Math.min(text.length, PIN_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const pin = pinDigits.join("").trim();
    if (!operatorId) {
      toast.error("Seleziona il tuo nome.");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN deve essere 4-6 cifre.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/staff/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueSlug, operatorId, pin }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          const message = data?.error?.message ?? "Errore di accesso.";
          toast.error(message);
          setPinDigits(Array(PIN_LENGTH).fill(""));
          inputRefs.current[0]?.focus();
          return;
        }
        router.push(data.redirectTo as string);
        router.refresh();
      } catch {
        toast.error("Errore di rete. Riprova.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="operator" className="text-base">
          Chi sei?
        </Label>
        <Select value={operatorId} onValueChange={setOperatorId} disabled={isPending}>
          <SelectTrigger id="operator" className="h-14 text-lg">
            <SelectValue placeholder="Seleziona il tuo nome" />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.id} value={op.id} className="text-lg py-3">
                {op.name} <span className="text-muted-foreground ml-2 text-sm">{ROLE_LABELS[op.role]}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-base">PIN</Label>
        <div className="flex gap-2 justify-center">
          {pinDigits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={isPending || !operatorId}
              aria-label={`PIN cifra ${i + 1}`}
              className="size-14 text-center text-2xl font-semibold rounded-lg border border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center pt-1">
          Inserisci il tuo PIN a 4-6 cifre. Non condividerlo con nessuno.
        </p>
      </div>

      <Button
        type="submit"
        className="w-full h-14 text-lg"
        disabled={isPending || !operatorId || pinDigits.join("").length < 4}
      >
        {isPending ? "Accesso in corso…" : "Accedi"}
      </Button>

      <p className="text-center text-xs text-muted-foreground pt-2">
        {venueName}
      </p>
    </form>
  );
}
