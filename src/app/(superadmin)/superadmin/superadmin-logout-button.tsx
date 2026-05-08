"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuperAdminLogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/superadmin/logout", { method: "POST" });
      router.push("/superadmin/login");
      router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      disabled={isPending}
      className="border-zinc-700 bg-transparent text-zinc-50 hover:bg-zinc-800"
    >
      <LogOut />
      {isPending ? "Disconnessione…" : "Esci"}
    </Button>
  );
}
