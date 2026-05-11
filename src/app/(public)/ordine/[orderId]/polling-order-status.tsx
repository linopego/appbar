"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const INTERVAL_MS = 2000;
const TIMEOUT_MS = 60000;

export function PollingOrderStatus({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const start = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; status?: string };
          if (data.ok && data.status && data.status !== "PENDING") {
            router.refresh();
            return;
          }
        }
      } catch {
        // continue polling
      }

      if (Date.now() - start > TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      if (!cancelled) timer = setTimeout(tick, INTERVAL_MS);
    }

    timer = setTimeout(tick, INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, router]);

  if (timedOut) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Sta richiedendo più tempo del previsto. Controlla la tua email.
        </p>
        <Button variant="outline" onClick={() => router.refresh()}>
          Aggiorna pagina
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
