import type Stripe from "stripe";
import { db } from "@/lib/db";

export async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;

  for (const refund of charge.refunds?.data ?? []) {
    if (!refund.id) continue;

    await db.refund.updateMany({
      where: { stripeRefundId: refund.id },
      data: {
        status: refund.status === "succeeded" ? "COMPLETED" : "PENDING",
        processedAt: refund.status === "succeeded" ? new Date() : null,
      },
    });
  }

  // La logica completa (aggiornare ticket → REFUNDED, order → REFUNDED/PARTIALLY_REFUNDED)
  // sarà aggiunta nel Prompt 9.
}
