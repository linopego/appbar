import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Stripe Connect: helper puri per il checkout con direct charge.
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentsOrg {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  active: boolean;
}

// Un'organizzazione può incassare solo se: attiva sulla piattaforma,
// connected account presente E charges abilitati da Stripe.
// Org disattivata → il checkout dei suoi venue si chiude (503), ma POS e
// rimborsi restano operativi: i ticket già venduti sono ancora validi.
export function isPaymentsConfigured(
  org: PaymentsOrg
): org is PaymentsOrg & { stripeAccountId: string } {
  return (
    org.active === true &&
    org.stripeAccountId !== null &&
    org.stripeChargesEnabled === true
  );
}

// Application fee in centesimi: calcolo intermedio in Decimal (mai float),
// arrotondamento solo alla fine. feePercent 0 → fee 0 (verrà omessa).
export function calculateApplicationFeeCents(
  totalCents: number,
  feePercent: Prisma.Decimal | string | number
): number {
  const fee = new Prisma.Decimal(totalCents)
    .mul(new Prisma.Decimal(feePercent))
    .div(100);
  return fee.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

// Fee in EUR (Decimal a 2 decimali) da salvare come snapshot sull'Order.
export function feeCentsToEur(feeCents: number): Prisma.Decimal {
  return new Prisma.Decimal(feeCents).div(100).toDecimalPlaces(2);
}
