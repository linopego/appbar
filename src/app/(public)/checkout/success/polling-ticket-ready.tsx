"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type OrderStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

interface PollingTicketReadyProps {
  orderId: string;
}

const MAX_ATTEMPTS = 20;
const INTERVAL_MS = 2000;

export function PollingTicketReady({ orderId }: PollingTicketReadyProps) {
  const [status, setStatus] = useState<OrderStatus>("PENDING");
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  }, [orderId]);

  if (status === "PENDING") {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <p className="text-muted-foreground text-sm">
          Conferma del pagamento in corso… (tentativo {attempts + 1}/{MAX_ATTEMPTS})
        </p>
      </div>
    );
  }

  if (status === "PAID") {
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">✓</div>
        <p className="font-semibold text-lg">Pagamento confermato!</p>
        <p className="text-muted-foreground text-sm">
          I tuoi ticket sono stati acquistati. Li trovi nel tuo profilo.
        </p>
        <Button asChild className="w-full">
          <Link href="/profilo">Vai al profilo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-5xl">⚠</div>
      <p className="font-semibold text-lg">Conferma in attesa</p>
      <p className="text-muted-foreground text-sm">
        Il pagamento potrebbe essere ancora in elaborazione. Controlla il tuo profilo tra qualche
        minuto o contatta il supporto.
      </p>
      <Button asChild variant="outline" className="w-full">
        <Link href="/profilo">Vai al profilo</Link>
      </Button>
    </div>
  );
}
