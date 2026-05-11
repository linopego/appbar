import type Stripe from "stripe";
import { db } from "@/lib/db";
import { handleCheckoutCompleted } from "./handlers/checkout-completed";
import { handleCheckoutExpired } from "./handlers/checkout-expired";
import { handleChargeRefunded } from "./handlers/charge-refunded";

export async function processStripeEvent(event: Stripe.Event) {
  const existing = await db.stripeEvent.findUnique({ where: { id: event.id } });
  if (existing) {
    console.log(`[Stripe] Event ${event.id} (${event.type}) già processato, skip`);
    return;
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event);
      break;
    case "checkout.session.expired":
      await handleCheckoutExpired(event);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event);
      break;
    default:
      console.log(`[Stripe] Event type non gestito: ${event.type}`);
  }

  await db.stripeEvent.create({
    data: {
      id: event.id,
      type: event.type,
      payload: event as unknown as object,
    },
  });
}
