import "server-only";
import { paymentsEnabled as stripeOn } from "./stripe";
import { paypalEnabled } from "./paypal";

export type PayMethod = "card" | "paypal";
/** Which online payment methods are configured right now (card = Stripe). Empty → bookings fall back to manual approval. */
export const payMethods = (): PayMethod[] => [...(stripeOn() ? ["card" as const] : []), ...(paypalEnabled() ? ["paypal" as const] : [])];
