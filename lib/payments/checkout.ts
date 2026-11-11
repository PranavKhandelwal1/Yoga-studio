import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { adminNewBooking, adminNotice, sendMail, visitorApproved, visitorCancelled, type BookingMailData } from "@/lib/email/send";
import { captureOrder, createOrder, getOrder, refundCapture, toCents } from "@/lib/payments/paypal";
import { confirmRetreatPayPal, confirmRetreatStripe } from "@/lib/payments/retreat";
import { onlineUrlOf } from "@/lib/utils/online";
import { SITE_URL, formatPrice } from "@/lib/utils/format";

const HOLD_MINUTES = 30; // Stripe's minimum Checkout lifetime; seats are held for this long while the visitor pays.

type BookingRow = { id: string; reference: string; full_name: string; email: string; participants: number; message: string | null; unit_price_cents: number | null; total_price_cents: number | null; currency: string };
type Joined = BookingRow & { class_sessions: { starts_at: string; location_override: string | null; classes: { title: string; location_name: string | null; delivery: string; class_private: { online_url: string | null } | { online_url: string | null }[] | null } | null } | null };

const SELECT = "id,reference,full_name,email,participants,message,unit_price_cents,total_price_cents,currency,class_sessions(starts_at,location_override,classes(title,location_name,delivery,class_private(online_url)))";

export async function loadBooking(db: SupabaseClient, id: string): Promise<Joined | null> {
  const { data } = await db.from("bookings").select(SELECT).eq("id", id).maybeSingle();
  return (data as unknown as Joined) ?? null;
}

export const toMailData = (b: Joined, extra: Partial<BookingMailData> = {}): BookingMailData => ({
  reference: b.reference, fullName: b.full_name, email: b.email, participants: b.participants, className: b.class_sessions?.classes?.title ?? "your class",
  startsAt: b.class_sessions?.starts_at ?? new Date().toISOString(), location: b.class_sessions?.location_override ?? b.class_sessions?.classes?.location_name, message: b.message, onlineUrl: onlineUrlOf(b.class_sessions?.classes), ...extra,
});

/** Creates the Stripe Checkout session for a PENDING booking. Amounts come from the database row, never from the browser. */
export async function startCheckout(db: SupabaseClient, stripe: Stripe, bookingId: string): Promise<string> {
  const b = await loadBooking(db, bookingId);
  if (!b || !b.unit_price_cents || !b.total_price_cents) throw new Error("Booking has nothing to pay");
  const when = b.class_sessions ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short" }).format(new Date(b.class_sessions.starts_at)) : "";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: b.email,
    client_reference_id: b.id,
    line_items: [{ quantity: b.participants, price_data: { currency: b.currency.toLowerCase(), unit_amount: b.unit_price_cents, product_data: { name: `${b.class_sessions?.classes?.title ?? "Yoga class"}`, description: `${when} · Be With Yoga, Mallorca` } } }],
    metadata: { booking_id: b.id, reference: b.reference },
    payment_intent_data: { description: `Be With Yoga booking ${b.reference}`, metadata: { booking_id: b.id, reference: b.reference } },
    success_url: `${SITE_URL}/book/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/book/cancelled?ref=${encodeURIComponent(b.reference)}`,
    expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60 + 30,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  const { error } = await db.from("bookings").update({ stripe_session_id: session.id }).eq("id", b.id);
  if (error) throw error;
  return session.url;
}

export type ConfirmResult = { state: "unpaid" | "confirmed" | "refunded"; bookingId?: string; enquiryId?: string };

/**
 * Verifies with Stripe that a Checkout session is paid, then confirms the booking (idempotent).
 * Called by the webhook AND the success page, so it works even if the webhook is delayed.
 */
export async function confirmCheckoutSession(db: SupabaseClient, stripe: Stripe, sessionId: string): Promise<ConfirmResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.kind === "retreat_deposit") return confirmRetreatStripe(db, stripe, session); // retreat deposits share this entry point
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) throw new Error("Checkout session has no booking");
  if (session.payment_status !== "paid") return { state: "unpaid", bookingId };

  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const { data, error } = await db.rpc("confirm_booking_payment", { p_booking_id: bookingId, p_session_id: session.id, p_payment_intent: intent, p_amount: session.amount_total });
  if (error) throw new Error(error.message);
  const res = data as { changed: boolean; status: string; needs_refund: boolean };

  return afterPayment(db, bookingId, res, async () => {
    if (intent) await stripe.refunds.create({ payment_intent: intent, metadata: { booking_id: bookingId, why: "paid after booking was cancelled" } }, { idempotencyKey: `refund-late-${bookingId}` });
  });
}

/** Shared tail of every successful payment: refund late payments, or email the visitor + Angela once. */
async function afterPayment(db: SupabaseClient, bookingId: string, res: { changed: boolean; needs_refund: boolean }, refund: () => Promise<void>): Promise<ConfirmResult> {
  const booking = await loadBooking(db, bookingId);
  if (res.needs_refund) {
    try { await refund(); } catch (e) {
      // The booking is already recorded as paid, so a retry would not refund again: tell Angela right away instead of failing silently.
      console.error("[payments] automatic refund failed", e);
      await sendMail(adminNotice(`REFUND FAILED — refund manually (${booking?.reference ?? bookingId})`, [`A payment arrived for booking ${booking?.reference ?? bookingId} after it had been cancelled, and the automatic refund failed.`, "Please refund it in your Stripe or PayPal dashboard."]));
      return { state: "refunded", bookingId };
    }
    await db.rpc("mark_booking_refunded", { p_booking_id: bookingId });
    if (booking) await sendMail(visitorCancelled(toMailData(booking, { note: "Your booking had already been cancelled, so your payment has been refunded in full.", refunded: formatPrice(booking.total_price_cents, booking.currency) })));
    return { state: "refunded", bookingId };
  }
  if (res.changed && booking) {
    const paid = formatPrice(booking.total_price_cents, booking.currency);
    await Promise.allSettled([sendMail(visitorApproved(toMailData(booking, { paid }))), sendMail(adminNewBooking(toMailData(booking, { paid })))]);
  }
  return { state: "confirmed", bookingId };
}

/** Creates the PayPal order for a PENDING booking (amount from the database) and returns the PayPal approval URL. */
export async function startPayPalCheckout(db: SupabaseClient, bookingId: string): Promise<string> {
  const b = await loadBooking(db, bookingId);
  if (!b || !b.unit_price_cents || !b.total_price_cents) throw new Error("Booking has nothing to pay");
  const when = b.class_sessions ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short" }).format(new Date(b.class_sessions.starts_at)) : "";
  const { orderId, approveUrl } = await createOrder({
    bookingId: b.id, reference: b.reference, title: b.class_sessions?.classes?.title ?? "Yoga class", description: `Be With Yoga booking ${b.reference} · ${when}`,
    unitCents: b.unit_price_cents, quantity: b.participants, currency: b.currency,
    returnUrl: `${SITE_URL}/book/paypal/return`, cancelUrl: `${SITE_URL}/book/cancelled?ref=${encodeURIComponent(b.reference)}`,
  });
  const { error } = await db.from("bookings").update({ paypal_order_id: orderId, payment_provider: "paypal" }).eq("id", b.id);
  if (error) throw error;
  return approveUrl;
}

/**
 * Called when the visitor returns from PayPal. Captures the order on the server, verifies status/currency/amount against
 * OUR booking row, then confirms (idempotent — a page refresh can't double-confirm).
 */
export async function confirmPayPalOrder(db: SupabaseClient, orderId: string): Promise<ConfirmResult> {
  const { data: row } = await db.from("bookings").select("id,currency,total_price_cents,paypal_order_id").eq("paypal_order_id", orderId).maybeSingle();
  if (!row) {
    const { data: enq } = await db.from("retreat_enquiries").select("id,retreats(currency)").eq("paypal_order_id", orderId).maybeSingle();
    if (!enq) throw new Error("Unknown PayPal order");
    const cur = (enq.retreats as unknown as { currency: string } | null)?.currency ?? "EUR";
    return confirmRetreatPayPal(db, orderId, enq.id, cur);
  }
  let order = await getOrder(orderId);
  if (order.status === "APPROVED") order = await captureOrder(orderId);
  const cap = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status !== "COMPLETED" || !cap || cap.status !== "COMPLETED") return { state: "unpaid", bookingId: row.id };
  if (cap.amount.currency_code.toUpperCase() !== String(row.currency).toUpperCase()) throw new Error("PayPal currency mismatch");
  const { data, error } = await db.rpc("confirm_paypal_payment", { p_booking_id: row.id, p_order_id: orderId, p_capture_id: cap.id, p_amount: toCents(cap.amount.value) });
  if (error) throw new Error(error.message);
  return afterPayment(db, row.id, data as { changed: boolean; needs_refund: boolean }, () => refundCapture(cap.id, row.id));
}

/** Refunds a paid booking in full (Stripe or PayPal) and records it. Returns true when a refund was issued. */
export async function refundBooking(db: SupabaseClient, stripe: Stripe | null, bookingId: string): Promise<boolean> {
  const { data: b } = await db.from("bookings").select("payment_status,payment_provider,stripe_payment_intent,paypal_capture_id").eq("id", bookingId).maybeSingle();
  if (!b || b.payment_status !== "paid") return false;
  if (b.payment_provider === "paypal") {
    if (!b.paypal_capture_id) return false;
    await refundCapture(b.paypal_capture_id, bookingId);
  } else {
    if (!b.stripe_payment_intent) return false;
    if (!stripe) throw new Error("Stripe is not configured, so this payment cannot be refunded automatically");
    await stripe.refunds.create({ payment_intent: b.stripe_payment_intent, metadata: { booking_id: bookingId } }, { idempotencyKey: `refund-${bookingId}` });
  }
  await db.rpc("mark_booking_refunded", { p_booking_id: bookingId });
  return true;
}
