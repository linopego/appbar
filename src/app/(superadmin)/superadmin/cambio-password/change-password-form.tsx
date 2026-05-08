"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminPasswordChangeSchema } from "@/lib/validators/auth-admin";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Le due password non coincidono.");
      return;
    }
    const parsed = adminPasswordChangeSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Password non valida.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/superadmin/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast.error(data?.error?.message ?? "Errore nel cambio password.");
          return;
        }
        toast.success("Password aggiornata.");
        router.push("/superadmin");
        router.refresh();
      } catch {
        toast.error("Errore di rete. Riprova.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current" className="text-zinc-300">Password attuale</Label>
        <Input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={isPending}
          className="bg-zinc-800 border-zinc-700 text-zinc-50"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new" className="text-zinc-300">Nuova password</Label>
        <Input
          id="new"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isPending}
          className="bg-zinc-800 border-zinc-700 text-zinc-50"
        />
        <p className="text-xs text-zinc-500">
          Almeno 12 caratteri, con maiuscole, minuscole e numeri.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm" className="text-zinc-300">Conferma nuova password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isPending}
          className="bg-zinc-800 border-zinc-700 text-zinc-50"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Aggiornamento…" : "Aggiorna password"}
      </Button>
    </form>
  );
}
