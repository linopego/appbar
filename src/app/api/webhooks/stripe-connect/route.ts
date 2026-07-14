import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { processStripeEvent } from "@/lib/stripe/process-event";

export const runtime = "nodejs";

// Webhook per gli EVENTI CONNECT (originati sui connected account: direct
// charge, onboarding). Hanno `event.account` e una firma dedicata: nel
// dashboard Stripe questo endpoint va creato con "Listen to events on
// connected accounts". Il webhook platform (/api/webhooks/stripe) resta
// attivo per gli ordini legacy pre-Connect.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env["STRIPE_CONNECT_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    console.error("STRIPE_CONNECT_WEBHOOK_SECRET non configurato");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    console.error("Stripe Connect signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await processStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing Stripe Connect event:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
