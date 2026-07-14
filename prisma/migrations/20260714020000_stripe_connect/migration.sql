-- Stripe Connect: flag di stato dell'onboarding sull'Organization e
-- tracciamento del connected account + application fee sull'Order.
-- Gli ordini esistenti restano legacy: stripeAccountId null, fee 0.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "Order" ADD COLUMN "platformFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
