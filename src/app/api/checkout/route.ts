import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";
import { checkoutSchema } from "@/lib/validators/checkout";
import { calculateOrderTotal } from "@/lib/checkout/total";
import {
  calculateApplicationFeeCents,
  feeCentsToEur,
  isPaymentsConfigured,
} from "@/lib/checkout/connect";
import { eurToCents } from "@/lib/utils/money";
import { checkRateLimit, checkoutLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils/request";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Devi essere autenticato." } },
      { status: 401 }
    );
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(checkoutLimiter, ip);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Troppe richieste. Riprova tra poco." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Payload non valido." } },
      { status: 400 }
    );
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dati non validi." },
      },
      { status: 422 }
    );
  }

  const { venueSlug, items } = parsed.data;

  const venue = await db.venue.findUnique({
    where: { slug: venueSlug, active: true },
    select: {
      id: true,
      name: true,
      organization: {
        select: {
          id: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          feePercent: true,
          active: true,
        },
      },
    },
  });

  if (!venue) {
    return NextResponse.json(
      { ok: false, error: { code: "VENUE_NOT_FOUND", message: "Locale non trovato." } },
      { status: 404 }
    );
  }

  // Direct charge sul connected account dell'organizzazione: senza onboarding
  // Stripe completato non si vende. Il gate sta PRIMA della creazione
  // dell'ordine: nessun ordine PENDING orfano.
  const organization = venue.organization;
  if (!isPaymentsConfigured(organization)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PAYMENTS_NOT_CONFIGURED",
          message: "Pagamenti non ancora attivi per questo locale.",
        },
      },
      { status: 503 }
    );
  }

  const priceTierIds = items.map((i) => i.priceTierId);
  const tiers = await db.priceTier.findMany({
    where: { id: { in: priceTierIds }, venueId: venue.id, active: true },
    select: { id: true, name: true, price: true },
  });

  if (tiers.length !== priceTierIds.length) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_TIERS", message: "Alcune fasce prezzo non sono valide." } },
      { status: 422 }
    );
  }

  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const lineItems = items.map((item) => {
    const tier = tierMap.get(item.priceTierId)!;
    return { pricePerUnit: tier.price, quantity: item.quantity };
  });

  const total = calculateOrderTotal(lineItems);
  const totalCents = eurToCents(total);

  // Application fee della piattaforma: Decimal fino in fondo, round solo alla fine
  const applicationFeeCents = calculateApplicationFeeCents(totalCents, organization.feePercent);
  const platformFeeAmount = feeCentsToEur(applicationFeeCents);

  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";

  // Create order + items in DB as PENDING (atomic)
  const placeholderSessionId = `pending-${crypto.randomUUID()}`;
  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customerId: session.user!.id,
        venueId: venue.id,
        totalAmount: total,
        status: "PENDING",
        stripeSessionId: placeholderSessionId,
        stripeAccountId: organization.stripeAccountId,
        platformFeeAmount,
      },
    });

    await tx.orderItem.createMany({
      data: items.map((item) => {
        const tier = tierMap.get(item.priceTierId)!;
        return {
          orderId: created.id,
          priceTierId: tier.id,
          quantity: item.quantity,
          unitPrice: tier.price,
          tierName: tier.name,
        };
      }),
    });

    return created;
  });

  // Build Stripe line items
  const stripeLineItems = items.map((item) => {
    const tier = tierMap.get(item.priceTierId)!;
    return {
      price_data: {
        currency: "eur",
        product_data: {
          name: `${tier.name} — ${venue.name}`,
        },
        unit_amount: eurToCents(tier.price),
      },
      quantity: item.quantity,
    };
  });

  // Direct charge: la sessione vive SUL connected account dell'organizzazione;
  // la piattaforma trattiene l'application fee (omessa quando feePercent = 0).
  const stripeSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: stripeLineItems,
      customer_email: session.user.email ?? undefined,
      success_url: `${appUrl}/checkout/success?order_id=${order.id}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      metadata: {
        orderId: order.id,
        customerId: session.user.id,
        venueId: venue.id,
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
        },
        ...(applicationFeeCents > 0
          ? { application_fee_amount: applicationFeeCents }
          : {}),
      },
    },
    { stripeAccount: organization.stripeAccountId }
  );

  // Update order with real Stripe session ID
  await db.order.update({
    where: { id: order.id },
    data: { stripeSessionId: stripeSession.id },
  });

  return NextResponse.json({ ok: true, url: stripeSession.url });
}
