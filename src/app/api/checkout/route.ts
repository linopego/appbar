import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";
import { checkoutSchema } from "@/lib/validators/checkout";
import { calculateOrderTotal } from "@/lib/checkout/total";
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
    select: { id: true, name: true },
  });

  if (!venue) {
    return NextResponse.json(
      { ok: false, error: { code: "VENUE_NOT_FOUND", message: "Locale non trovato." } },
      { status: 404 }
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

  const stripeSession = await stripe.checkout.sessions.create({
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
    },
  });

  // Update order with real Stripe session ID
  await db.order.update({
    where: { id: order.id },
    data: { stripeSessionId: stripeSession.id },
  });

  return NextResponse.json({ ok: true, url: stripeSession.url });
}
