"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await signOut({ redirectTo: "/" });
    });
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={isPending}>
      <LogOut />
      {isPending ? "Disconnessione…" : "Esci"}
    </Button>
  );
}
