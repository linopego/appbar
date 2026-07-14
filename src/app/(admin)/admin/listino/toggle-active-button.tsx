"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ToggleActiveButton({ tierId, active, name }: { tierId: string; active: boolean; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm(`${active ? "Disattivare" : "Riattivare"} la fascia "${name}"?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/price-tiers/${tierId}/toggle-active`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`text-xs px-3 py-1 rounded-lg border transition-colors disabled:opacity-50 ${active
        ? "border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50"
        : "border-green-200 text-green-700 hover:border-green-400 hover:bg-green-50"
      }`}
    >
      {loading ? "…" : active ? "Disattiva" : "Riattiva"}
    </button>
  );
}
