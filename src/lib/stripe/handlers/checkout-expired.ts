import type Stripe from "stripe";
import { db } from "@/lib/db";

export async function handleCheckoutExpired(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.["orderId"];
  if (!orderId) return;

  await db.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}
