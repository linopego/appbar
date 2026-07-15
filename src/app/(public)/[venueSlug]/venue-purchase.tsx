"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/lib/utils/money";
import {
  CART_MAX_PER_TIER,
  cartStorageKey,
  parseCart,
  serializeCart,
} from "@/lib/checkout/cart-persistence";
import { Prisma } from "@prisma/client";

interface TierRow {
  id: string;
  name: string;
  price: string;
}

interface VenuePurchaseProps {
  venueSlug: string;
  priceTiers: TierRow[];
  isLoggedIn: boolean;
}

// Interfaccia d'acquisto diretta di /[venueSlug]: chi scansiona il QR al
// bancone compra subito. Loggato: + sulla fascia → Paga → Stripe (2 tap).
// Non loggato: Paga salva la selezione, login, al ritorno la ritrova.
export function VenuePurchase({ venueSlug, priceTiers, isLoggedIn }: VenuePurchaseProps) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Ripristino della selezione dopo il giro di login. DEVE stare in un
  // effect: sessionStorage non esiste in SSR e un lazy initializer
  // causerebbe hydration mismatch. SetState una tantum al mount è voluto.
  useEffect(() => {
    try {
      const key = cartStorageKey(venueSlug);
      const saved = parseCart(
        sessionStorage.getItem(key),
        priceTiers.map((t) => t.id)
      );
      if (Object.keys(saved).length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setQuantities(saved);
        sessionStorage.removeItem(key);
      }
    } catch {
      // storage non disponibile (private mode): si riparte da zero
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueSlug]);

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalAmount = priceTiers.reduce((acc, tier) => {
    const qty = quantities[tier.id] ?? 0;
    if (qty === 0) return acc;
    return acc.plus(new Prisma.Decimal(tier.price).times(qty));
  }, new Prisma.Decimal(0));

  function increment(id: string) {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.min((prev[id] ?? 0) + 1, CART_MAX_PER_TIER),
    }));
  }

  function decrement(id: string) {
    setQuantities((prev) => ({ ...prev, [id]: Math.max((prev[id] ?? 0) - 1, 0) }));
  }

  function handlePay() {
    setError(null);
    const items = priceTiers
      .filter((t) => (quantities[t.id] ?? 0) > 0)
      .map((t) => ({ priceTierId: t.id, quantity: quantities[t.id] ?? 0 }));

    if (items.length === 0) return;

    // Non loggato: selezione in sessionStorage, poi login con ritorno qui
    if (!isLoggedIn) {
      try {
        sessionStorage.setItem(cartStorageKey(venueSlug), serializeCart(quantities));
      } catch {
        // senza storage la selezione si perde: pazienza, il login resta possibile
      }
      router.push(`/login?callbackUrl=${encodeURIComponent(`/${venueSlug}`)}`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueSlug, items }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          url?: string;
          error?: { message: string };
        };
        if (!data.ok || !data.url) {
          setError(data.error?.message ?? "Errore durante il checkout.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Errore di rete. Riprova.");
      }
    });
  }

  return (
    <>
      {/* Listino operativo: righe touch con stepper (feedback lime/rosso) */}
      <ul className="space-y-2.5">
        {priceTiers.map((tier) => {
          const qty = quantities[tier.id] ?? 0;
          return (
            <li
              key={tier.id}
              className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-display font-semibold truncate">{tier.name}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatEur(tier.price)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="negative"
                  size="sm"
                  className="h-12 w-12 p-0 text-2xl"
                  onClick={() => decrement(tier.id)}
                  disabled={qty === 0}
                  aria-label={`Rimuovi ${tier.name}`}
                >
                  −
                </Button>
                <span className="w-8 text-center text-xl font-semibold tabular-nums">
                  {qty}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-12 w-12 p-0 text-2xl"
                  onClick={() => increment(tier.id)}
                  aria-label={`Aggiungi ${tier.name}`}
                >
                  +
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="text-sm text-destructive mt-3">{error}</p>}

      {/* Barra totale sticky: sempre a portata di pollice */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 max-w-2xl flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">
              {totalItems === 0
                ? "Nessun ticket selezionato"
                : `${totalItems} ticket`}
            </p>
            <p className="text-xl font-semibold tabular-nums">Totale {formatEur(totalAmount)}</p>
          </div>
          <Button
            size="lg"
            className="px-10"
            disabled={totalItems === 0 || isPending}
            onClick={handlePay}
          >
            {isPending ? "Un attimo…" : "Paga"}
          </Button>
        </div>
      </div>
    </>
  );
}
