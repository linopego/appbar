import type Stripe from "stripe";
import { db } from "@/lib/db";

// Evento Connect account.updated: sincronizza sullo stato dell'organizzazione
// i flag di onboarding del connected account. È l'unica fonte di verità con
// cui stripeChargesEnabled diventa true e il checkout si sblocca.
export async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;

  const result = await db.organization.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      stripeChargesEnabled: account.charges_enabled === true,
      stripeDetailsSubmitted: account.details_submitted === true,
    },
  });

  if (result.count === 0) {
    console.log(`[Stripe Connect] account.updated per ${account.id}: nessuna organizzazione collegata, skip`);
  } else {
    console.log(
      `[Stripe Connect] Organizzazione con account ${account.id} aggiornata: charges_enabled=${account.charges_enabled}, details_submitted=${account.details_submitted}`
    );
  }
}
