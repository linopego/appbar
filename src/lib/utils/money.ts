import { Prisma } from "@prisma/client";

export function formatEur(amount: Prisma.Decimal | number | string): string {
  const num = typeof amount === "object" ? amount.toNumber() : Number(amount);
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(num);
}

export function eurToCents(amount: Prisma.Decimal | number | string): number {
  const num = typeof amount === "object" ? amount.toNumber() : Number(amount);
  return Math.round(num * 100);
}
