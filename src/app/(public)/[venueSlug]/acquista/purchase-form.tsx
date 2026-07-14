"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PriceTierCard } from "@/components/shared/price-tier-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatEur } from "@/lib/utils/money";
import { Prisma } from "@prisma/client";

interface TierRow {
  id: string;
  name: string;
  price: string;
}

interface PurchaseFormProps {
  venueSlug: string;
  venueName: string;
  priceTiers: TierRow[];
}

export function PurchaseForm({ venueSlug, venueName, priceTiers }: PurchaseFormProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(priceTiers.map((t) => [t.id, 0]))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);

  const totalAmount = priceTiers.reduce((acc, tier) => {
    const qty = quantities[tier.id] ?? 0;
    if (qty === 0) return acc;
    return acc.plus(new Prisma.Decimal(tier.price).times(qty));
  }, new Prisma.Decimal(0));

  function increment(id: string) {
    setQuantities((prev) => ({ ...prev, [id]: Math.min((prev[id] ?? 0) + 1, 20) }));
  }

  function decrement(id: string) {
    setQuantities((prev) => ({ ...prev, [id]: Math.max((prev[id] ?? 0) - 1, 0) }));
  }

  function handleSubmit() {
    setError(null);
    const items = priceTiers
      .filter((t) => (quantities[t.id] ?? 0) > 0)
      .map((t) => ({ priceTierId: t.id, quantity: quantities[t.id] ?? 0 }));

    if (items.length === 0) {
      setError("Seleziona almeno un ticket.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueSlug, items }),
        });

        const data = (await res.json()) as { ok: boolean; url?: string; error?: { message: string } };

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
    <div className="space-y-6">
      <div>
        <Link
          href={`/${venueSlug}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {venueName}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-4 mb-2">Acquista ticket</h1>
        <p className="text-muted-foreground">Seleziona le quantità per ogni tipo di ticket.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {priceTiers.map((tier) => (
          <PriceTierCard
            key={tier.id}
            id={tier.id}
            name={tier.name}
            price={tier.price}
            quantity={quantities[tier.id] ?? 0}
            onIncrement={() => increment(tier.id)}
            onDecrement={() => decrement(tier.id)}
          />
        ))}
      </div>

      {totalItems > 0 && (
        <Card>
          <CardContent className="pt-4 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {totalItems} {totalItems === 1 ? "ticket" : "ticket"} selezionati
            </span>
            <span className="text-xl font-semibold">{formatEur(totalAmount)}</span>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        className="w-full"
        size="lg"
        disabled={totalItems === 0 || isPending}
        onClick={handleSubmit}
      >
        {isPending ? "Reindirizzamento..." : "Vai al pagamento"}
      </Button>
    </div>
  );
}
