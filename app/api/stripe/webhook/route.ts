import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/payments/stripe";
import { confirmCheckoutSession } from "@/lib/payments/checkout";

export const runtime = "nodejs";

/**
 * Stripe → us. The signature is verified with STRIPE_WEBHOOK_SECRET; payment status is then re-read
 * from Stripe itself, so a forged or replayed request can't confirm anything.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe(); const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), sig, secret); }
  catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }

  const db = createAdminClient();
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await confirmCheckoutSession(db, stripe, (event.data.object as Stripe.Checkout.Session).id);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const id = (event.data.object as Stripe.Checkout.Session).metadata?.booking_id;
        if (id) await db.rpc("release_unpaid_booking", { p_booking_id: id }); // frees the held seats
        break;
      }
    }
  } catch (e) {
    console.error("[stripe webhook]", event.type, e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Stripe will retry
  }
  return NextResponse.json({ received: true });
}
