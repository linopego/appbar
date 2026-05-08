"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  venueSlug: string;
}

export function StaffLogoutButton({ venueSlug }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/staff/logout", { method: "POST" });
      router.push(`/staff/${venueSlug}`);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={isPending}>
      <LogOut />
      {isPending ? "Disconnessione…" : "Esci"}
    </Button>
  );
}
