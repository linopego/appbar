"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrganizationToggleButton({
  organizationId,
  active,
  name,
}: {
  organizationId: string;
  active: boolean;
  name: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const message = active
      ? `Disattivare "${name}"?\n\nEffetto: il checkout dei suoi venue verrà bloccato (i clienti non potranno più acquistare). POS e rimborsi continueranno a funzionare: i ticket già venduti restano validi.`
      : `Riattivare "${name}"?\n\nEffetto: il checkout dei suoi venue tornerà disponibile (se i pagamenti Stripe sono configurati).`;
    if (!confirm(message)) return;

    setLoading(true);
    try {
      await fetch(`/api/superadmin/organizations/${organizationId}/toggle-active`, {
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
      {loading ? "…" : active ? "Disattiva" : "Riattiva"}
    </button>
  );
}
