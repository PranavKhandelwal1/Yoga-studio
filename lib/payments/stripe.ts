import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;
/** Stripe client, or null when payments aren't configured (the site then falls back to manual approval). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return (client ??= new Stripe(key));
}
export const paymentsEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);
