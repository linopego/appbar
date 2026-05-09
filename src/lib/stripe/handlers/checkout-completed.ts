import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/email/order-confirmation";

const TICKET_VALIDITY_DAYS = 30;

export async function createTicketsForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  venueId: string,
  customerId: string
) {
  const existing = await tx.ticket.findMany({ where: { orderId } });
  if (existing.length > 0) return existing;

  const items = await tx.orderItem.findMany({ where: { orderId } });
  if (items.length === 0) {
    throw new Error(`Order ${orderId} non ha OrderItem`);
  }

  const expiresAt = addDays(new Date(), TICKET_VALIDITY_DAYS);
  const ticketsData: Prisma.TicketCreateManyInput[] = [];

  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      ticketsData.push({
        orderId,
        customerId,
        venueId,
        priceTierId: item.priceTierId,
        qrToken: randomUUID(),
        status: "ACTIVE",
        expiresAt,
      });
    }
  }

  await tx.ticket.createMany({ data: ticketsData });
  return tx.ticket.findMany({ where: { orderId } });
}

export async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.["orderId"];

  if (!orderId) {
    console.error(
      "[Stripe] checkout.session.completed senza orderId in metadata",
      session.id
    );
    return;
  }

  const result = await db.$transaction(
    async (tx) => {
      const orders = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          venueId: string;
          customerId: string;
        }>
      >`
        SELECT id, status, "venueId", "customerId"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `;
      const order = orders[0];

      if (!order) {
        return { skip: true as const, reason: "order_not_found" };
      }

      if (order.status === "PAID") {
        return { skip: true as const, reason: "already_paid" };
      }

      if (order.status !== "PENDING") {
        return { skip: true as const, reason: `invalid_state:${order.status}` };
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          stripePaymentId: paymentIntentId,
        },
      });

      const tickets = await createTicketsForOrder(
        tx,
        orderId,
        order.venueId,
        order.customerId
      );

      return { skip: false as const, ticketsCount: tickets.length };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 15000,
    }
  );

  if (result.skip) {
    console.log(`[Stripe] Skip processamento order ${orderId}: ${result.reason}`);
    return;
  }

  console.log(`[Stripe] Order ${orderId} PAID, ${result.ticketsCount} ticket creati`);

  try {
    await sendOrderConfirmationEmail(orderId);
  } catch (err) {
    console.error(`[Stripe] Invio email fallito per order ${orderId}:`, err);
  }
}
