import { Prisma } from "@prisma/client";

export interface LineItem {
  pricePerUnit: Prisma.Decimal | number | string;
  quantity: number;
}

export function calculateOrderTotal(items: LineItem[]): Prisma.Decimal {
  return items.reduce((acc, item) => {
    const price =
      item.pricePerUnit instanceof Prisma.Decimal
        ? item.pricePerUnit
        : new Prisma.Decimal(item.pricePerUnit);
    return acc.plus(price.times(new Prisma.Decimal(item.quantity)));
  }, new Prisma.Decimal(0));
}
