import type Stripe from "stripe";
import { db } from "@/lib/db";

export async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;

  for (const stripeRefund of charge.refunds?.data ?? []) {
    if (!stripeRefund.id || stripeRefund.status !== "succeeded") continue;

    const refund = await db.refund.findUnique({
      where: { stripeRefundId: stripeRefund.id },
    });

    if (!refund) {
      console.log(`[Stripe] No refund found for stripeRefundId=${stripeRefund.id}, skip`);
      continue;
    }

    if (refund.status === "COMPLETED") {
      console.log(`[Stripe] Refund ${refund.id} already COMPLETED, skip`);
      continue;
    }

    if (refund.status !== "APPROVED") {
      console.log(`[Stripe] Refund ${refund.id} in unexpected status=${refund.status}, skip`);
      continue;
    }

    await db.refund.update({
      where: { id: refund.id },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });

    console.log(`[Stripe] Refund ${refund.id} marked COMPLETED via webhook`);
  }
}
