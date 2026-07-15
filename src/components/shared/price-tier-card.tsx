"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/lib/utils/money";
import { Prisma } from "@prisma/client";

interface PriceTierCardProps {
  id: string;
  name: string;
  price: Prisma.Decimal | number | string;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function PriceTierCard({
  name,
  price,
  quantity,
  onIncrement,
  onDecrement,
}: PriceTierCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{name}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4 pt-0">
        <span className="text-lg font-semibold tabular-nums">{formatEur(price)}</span>
        {/* Stepper con feedback di pressione (BRAND.md §6-bis):
            + affermativo (lime), − negativo (error-soft) */}
        <div className="flex items-center gap-2">
          <Button
            variant="negative"
            size="sm"
            className="h-11 w-11 p-0 text-xl"
            onClick={onDecrement}
            disabled={quantity === 0}
            aria-label={`Rimuovi ${name}`}
          >
            −
          </Button>
          <span className="w-7 text-center text-lg tabular-nums">{quantity}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-11 w-11 p-0 text-xl"
            onClick={onIncrement}
            aria-label={`Aggiungi ${name}`}
          >
            +
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
