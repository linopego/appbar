"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Props {
  venueName: string;
  operatorName: string;
  venueSlug: string;
}

export function AdminHeader({ venueName, operatorName, venueSlug }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/staff/logout", { method: "POST" });
      router.push(`/staff/${venueSlug}`);
    });
  }

  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-3 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="font-bold text-zinc-900 hover:text-zinc-700">
          Pannello Admin
        </Link>
        <span className="text-zinc-300">·</span>
        <span className="text-sm text-zinc-500">{venueName}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-zinc-500 hidden sm:inline">{operatorName}</span>
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="text-zinc-500 hover:text-zinc-900 underline disabled:opacity-50"
        >
          {isPending ? "Uscita…" : "Esci"}
        </button>
      </div>
    </header>
  );
}
