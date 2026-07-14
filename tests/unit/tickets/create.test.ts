import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { addDays } from "date-fns";
import { createTicketsForOrder } from "@/lib/stripe/handlers/checkout-completed";

interface FakeTicket {
  id: string;
  orderId: string;
  customerId: string;
  venueId: string;
  priceTierId: string;
  qrToken: string;
  status: string;
  expiresAt: Date;
}

interface FakeOrderItem {
  orderId: string;
  priceTierId: string;
  quantity: number;
}

function makeTx(items: FakeOrderItem[]) {
  const tickets: FakeTicket[] = [];
  let counter = 0;

  return {
    tx: {
      ticket: {
        findMany: async ({ where }: { where: { orderId: string } }) =>
          tickets.filter((t) => t.orderId === where.orderId),
        createMany: async ({ data }: { data: Prisma.TicketCreateManyInput[] }) => {
          for (const row of data) {
            tickets.push({
              id: `t_${++counter}`,
              orderId: row.orderId,
              customerId: row.customerId,
              venueId: row.venueId,
              priceTierId: row.priceTierId,
              qrToken: row.qrToken as string,
              status: row.status as string,
              expiresAt: row.expiresAt as Date,
            });
          }
          return { count: data.length };
        },
      },
      orderItem: {
        findMany: async ({ where }: { where: { orderId: string } }) =>
          items.filter((i) => i.orderId === where.orderId),
      },
    } as unknown as Prisma.TransactionClient,
    tickets,
  };
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("createTicketsForOrder", () => {
  it("crea N ticket: 1 per ogni unità di ogni OrderItem", async () => {
    const items: FakeOrderItem[] = [
      { orderId: "order_1", priceTierId: "tier_drink", quantity: 3 },
      { orderId: "order_1", priceTierId: "tier_beer", quantity: 2 },
    ];
    const { tx, tickets } = makeTx(items);
    const result = await createTicketsForOrder(tx, "order_1", "venue_1", "customer_1");
    expect(result.length).toBe(5);
    expect(tickets.filter((t) => t.priceTierId === "tier_drink").length).toBe(3);
    expect(tickets.filter((t) => t.priceTierId === "tier_beer").length).toBe(2);
  });

  it("ogni ticket ha un qrToken UUID v4 unico", async () => {
    const items: FakeOrderItem[] = [
      { orderId: "order_1", priceTierId: "tier_drink", quantity: 5 },
    ];
    const { tx } = makeTx(items);
    const result = await createTicketsForOrder(tx, "order_1", "venue_1", "customer_1");
    const tokens = result.map((t) => t.qrToken);
    expect(new Set(tokens).size).toBe(5);
    for (const token of tokens) {
      expect(token).toMatch(UUID_V4_REGEX);
    }
  });

  it("expiresAt è circa 30 giorni nel futuro", async () => {
    const items: FakeOrderItem[] = [
      { orderId: "order_1", priceTierId: "tier_drink", quantity: 1 },
    ];
    const { tx } = makeTx(items);
    const result = await createTicketsForOrder(tx, "order_1", "venue_1", "customer_1");
    const expected = addDays(new Date(), 30).getTime();
    const diff = Math.abs(result[0]!.expiresAt.getTime() - expected);
    expect(diff).toBeLessThan(5000); // entro 5 secondi
  });

  it("è idempotente: chiamata due volte non duplica", async () => {
    const items: FakeOrderItem[] = [
      { orderId: "order_1", priceTierId: "tier_drink", quantity: 3 },
    ];
    const { tx, tickets } = makeTx(items);
    await createTicketsForOrder(tx, "order_1", "venue_1", "customer_1");
    const second = await createTicketsForOrder(tx, "order_1", "venue_1", "customer_1");
    expect(second.length).toBe(3);
    expect(tickets.length).toBe(3);
  });

  it("solleva errore se l'order non ha OrderItem", async () => {
    const { tx } = makeTx([]);
    await expect(
      createTicketsForOrder(tx, "order_1", "venue_1", "customer_1")
    ).rejects.toThrow(/non ha OrderItem/);
  });
});
