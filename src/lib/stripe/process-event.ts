import type Stripe from "stripe";
import { db } from "@/lib/db";
import { handleCheckoutCompleted } from "./handlers/checkout-completed";
import { handleCheckoutExpired } from "./handlers/checkout-expired";
import { handleChargeRefunded } from "./handlers/charge-refunded";
import { handleAccountUpdated } from "./handlers/account-updated";

// Processa un evento Stripe, sia platform che Connect. Gli eventi Connect
// portano `event.account` (l'id del connected account di origine): gli handler
// che dovessero chiamare l'API Stripe devono usarlo come `stripeAccount`.
// L'idempotenza è condivisa: gli id evento Stripe sono globalmente unici,
// quindi la stessa tabella StripeEvent copre entrambi gli endpoint webhook.
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
    case "account.updated":
      await handleAccountUpdated(event);
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
