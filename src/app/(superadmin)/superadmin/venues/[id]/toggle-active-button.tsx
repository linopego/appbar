"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VenueToggleActiveButton({
  venueId,
  active,
  name,
}: {
  venueId: string;
  active: boolean;
  name: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const action = active ? "disattivare" : "riattivare";
    if (!confirm(`Vuoi ${action} il venue "${name}"?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/superadmin/venues/${venueId}/toggle-active`, {
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
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        active
          ? "bg-red-600 hover:bg-red-500 text-white"
          : "bg-zinc-100 text-zinc-900 hover:bg-white"
      }`}
    >
      {loading ? "…" : active ? "Disattiva venue" : "Riattiva venue"}
    </button>
  );
}
