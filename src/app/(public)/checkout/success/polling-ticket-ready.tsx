"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type OrderStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

interface OrderSummary {
  venueName: string;
  total: string; // già formattato in EUR
  items: { tierName: string; quantity: number }[];
}

interface PollingTicketReadyProps {
  orderId: string;
  initialStatus: OrderStatus;
  summary: OrderSummary;
}

const MAX_ATTEMPTS = 20;
const INTERVAL_MS = 2000;

// Riepilogo dell'ordine: i ticket acquistati, visibile in ogni stato
function SummaryPanel({ summary }: { summary: OrderSummary }) {
  return (
    <div className="rounded-xl border bg-klink-bg/60 p-4 text-left">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        {summary.venueName}
      </p>
      <ul className="space-y-1">
        {summary.items.map((item) => (
          <li key={item.tierName} className="flex items-center justify-between text-sm">
            <span>
              {item.quantity}× {item.tierName}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t mt-3 pt-2 text-sm font-semibold">
        <span>Totale</span>
        <span className="tabular-nums">{summary.total}</span>
      </div>
    </div>
  );
}

// CTA primaria post-acquisto: SEMPRE verso /home, dove vivono i ticket
function GoToTicketsButton({ variant }: { variant?: "outline" }) {
  return (
    <Button asChild variant={variant} className="w-full">
      <Link href="/home">Vai ai tuoi ticket</Link>
    </Button>
  );
}

export function PollingTicketReady({ orderId, initialStatus, summary }: PollingTicketReadyProps) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Ordine già confermato lato server: niente polling
    if (initialStatus !== "PENDING") return;

    let cancelled = false;

    async function poll() {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        if (!res.ok) {
          setStatus("FAILED");
          return;
        }
        const data = (await res.json()) as { ok: boolean; status?: OrderStatus };
        if (!data.ok) {
          setStatus("FAILED");
          return;
        }
        if (data.status && data.status !== "PENDING") {
          setStatus(data.status);
          return;
        }
      } catch {
        // network error — keep polling
      }

      setAttempts((a) => {
        const next = a + 1;
        if (next >= MAX_ATTEMPTS) {
          setStatus("FAILED");
          return next;
        }
        if (!cancelled) {
          timerRef.current = setTimeout(poll, INTERVAL_MS);
        }
        return next;
      });
    }

    timerRef.current = setTimeout(poll, INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [orderId, initialStatus]);

  if (status === "PENDING") {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <p className="font-semibold">Stiamo preparando i tuoi ticket…</p>
        <p className="text-muted-foreground text-xs">
          Il pagamento è andato a buon fine: pochi secondi e i QR sono pronti
          (tentativo {attempts + 1}/{MAX_ATTEMPTS}).
        </p>
        <SummaryPanel summary={summary} />
        <GoToTicketsButton variant="outline" />
      </div>
    );
  }

  if (status === "PAID") {
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl text-klink-ink">✓</div>
        <p className="font-semibold text-lg">Pagamento confermato</p>
        <p className="text-muted-foreground text-sm">
          I tuoi ticket sono pronti: li trovi tra i tuoi ticket, con un QR per ogni
          consumazione.
        </p>
        <SummaryPanel summary={summary} />
        <GoToTicketsButton />
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <AlertTriangle aria-hidden className="mx-auto h-12 w-12 text-klink-warning" />
      <p className="font-semibold text-lg">Conferma in attesa</p>
      <p className="text-muted-foreground text-sm">
        Il pagamento potrebbe essere ancora in elaborazione. Controlla i tuoi ticket tra
        qualche minuto o contatta il supporto.
      </p>
      <SummaryPanel summary={summary} />
      <GoToTicketsButton variant="outline" />
    </div>
  );
}
