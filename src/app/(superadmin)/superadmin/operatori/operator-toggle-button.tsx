"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SuperAdminOperatorToggleButton({
  operatorId,
  active,
  name,
}: {
  operatorId: string;
  active: boolean;
  name: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const action = active ? "disattivare" : "riattivare";
    if (!confirm(`Vuoi ${action} l'operatore "${name}"?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/superadmin/operators/${operatorId}/toggle-active`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`text-xs px-3 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
        active
          ? "border-red-800 text-red-400 hover:border-red-600 hover:bg-red-950/30"
          : "border-green-800 text-green-400 hover:border-green-600 hover:bg-green-950/30"
      }`}
    >
      {loading ? "…" : active ? "Disattiva" : "Riattiva"}
    </button>
  );
}
