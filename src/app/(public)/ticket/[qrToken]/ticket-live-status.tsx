"use client";

import { useEffect, useState } from "react";
import type { EffectiveTicketStatus } from "@/lib/tickets/status";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 5000;
const TERMINAL: EffectiveTicketStatus[] = ["CONSUMED", "EXPIRED", "REFUNDED"];

interface Props {
  qrToken: string;
  initialStatus: EffectiveTicketStatus;
}

const STATUS_BG: Record<EffectiveTicketStatus, string> = {
  ACTIVE: "bg-white",
  EXPIRED: "bg-zinc-100",
  CONSUMED: "bg-zinc-200",
  REFUNDED: "bg-red-50",
};

const STATUS_OVERLAY: Record<EffectiveTicketStatus, { label: string; className: string } | null> = {
  ACTIVE: null,
  EXPIRED: { label: "Scaduto", className: "bg-zinc-700" },
  CONSUMED: { label: "✓ Consegnato", className: "bg-green-700" },
  REFUNDED: { label: "Rimborsato", className: "bg-red-700" },
};

export function TicketLiveStatus({ qrToken, initialStatus }: Props) {
  const [status, setStatus] = useState<EffectiveTicketStatus>(initialStatus);
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    if (TERMINAL.includes(status)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/tickets/${qrToken}/status`);
        if (res.ok) {
          const data = (await res.json()) as {
            ok: boolean;
            data?: { effectiveStatus: EffectiveTicketStatus };
          };
          if (data.ok && data.data && data.data.effectiveStatus !== status) {
            setJustChanged(true);
            setStatus(data.data.effectiveStatus);
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try {
                navigator.vibrate(200);
              } catch {
                // ignore
              }
            }
            return;
          }
        }
      } catch {
        // continue
      }
      if (!cancelled) timer = setTimeout(poll, INTERVAL_MS);
    }

    timer = setTimeout(poll, INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [qrToken, status]);

  const overlay = STATUS_OVERLAY[status];

  return (
    <div
      className={cn(
        "fixed inset-0 -z-10 transition-colors duration-500",
        STATUS_BG[status]
      )}
      data-status={status}
    >
      {overlay && (
        <div
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] z-50",
            "px-8 py-4 rounded-2xl shadow-2xl text-white text-3xl font-bold",
            overlay.className,
            justChanged && "animate-in fade-in zoom-in"
          )}
        >
          {overlay.label}
        </div>
      )}
    </div>
  );
}
