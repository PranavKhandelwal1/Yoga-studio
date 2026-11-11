import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { adminNotice, retreatDepositReceived, retreatDepositRefunded, sendMail } from "@/lib/email/send";
import { captureOrder, createOrder, getOrder, refundCapture, toCents } from "@/lib/payments/paypal";
import { SITE_URL, formatPrice } from "@/lib/utils/format";

/**
 * Retreat deposits. A guest asks for places; the deposit (per-person deposit × people, read from the DATABASE) is paid via Stripe
 * or PayPal; only then are places taken (inside Postgres, with the retreat row locked, so a full retreat can never be oversold).
 * If the retreat fills up while someone is paying, their payment is refunded automatically.
 */
type Row = { id: string; reference: string; full_name: string; email: string; participants: number; deposit_cents: number | null; payment_status: string; retreats: { slug: string; title: string; currency: string; start_date: string | null; end_date: string | null; location: string | null } | null };
const SELECT = "id,reference,full_name,email,participants,deposit_cents,payment_status,retreats(slug,title,currency,start_date,end_date,location)";
export type RetreatResult = { state: "unpaid" | "confirmed" | "refunded"; enquiryId?: string };

export async function loadEnquiry(db: SupabaseClient, id: string): Promise<Row | null> {
  const { data } = await db.from("retreat_enquiries").select(SELECT).eq("id", id).maybeSingle();
  return (data as unknown as Row) ?? null;
}
const dates = (r: NonNullable<Row["retreats"]>) => [r.start_date, r.end_date].filter(Boolean).join(" → ");
const mail = (e: Row, extra: { paid?: string; refunded?: string } = {}) => ({ to: e.email, fullName: e.full_name, retreat: e.retreats?.title ?? "your retreat", dates: e.retreats ? dates(e.retreats) : "", location: e.retreats?.location ?? null, participants: e.participants, reference: e.reference, ...extra });

export async function startRetreatStripe(db: SupabaseClient, stripe: Stripe, id: string): Promise<string> {
  const e = await loadEnquiry(db, id);
  if (!e?.retreats || !e.deposit_cents) throw new Error("Nothing to pay");
  const session = await stripe.checkout.sessions.create({
    mode: "payment", customer_email: e.email, client_reference_id: e.id,
    line_items: [{ quantity: 1, price_data: { currency: e.retreats.currency.toLowerCase(), unit_amount: e.deposit_cents, product_data: { name: `${e.retreats.title} — deposit`, description: `${e.participants} ${e.participants === 1 ? "place" : "places"} · Be With Yoga, Mallorca` } } }],
    metadata: { kind: "retreat_deposit", enquiry_id: e.id, reference: e.reference },
    payment_intent_data: { description: `Be With Yoga retreat deposit ${e.reference}`, metadata: { kind: "retreat_deposit", enquiry_id: e.id } },
    success_url: `${SITE_URL}/book/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/retreats/${e.retreats.slug}?payment=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60 + 30,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  const { error } = await db.from("retreat_enquiries").update({ stripe_session_id: session.id, payment_provider: "stripe" }).eq("id", e.id);
  if (error) throw error;
  return session.url;
}

export async function startRetreatPayPal(db: SupabaseClient, id: string): Promise<string> {
  const e = await loadEnquiry(db, id);
  if (!e?.retreats || !e.deposit_cents) throw new Error("Nothing to pay");
  const { orderId, approveUrl } = await createOrder({
    bookingId: e.id, reference: e.reference, title: `${e.retreats.title} — deposit`, description: `Be With Yoga retreat deposit ${e.reference}`,
    unitCents: e.deposit_cents, quantity: 1, currency: e.retreats.currency,
    returnUrl: `${SITE_URL}/book/paypal/return`, cancelUrl: `${SITE_URL}/retreats/${e.retreats.slug}?payment=cancelled`,
  });
  const { error } = await db.from("retreat_enquiries").update({ paypal_order_id: orderId, payment_provider: "paypal" }).eq("id", e.id);
  if (error) throw error;
  return approveUrl;
}

async function finish(db: SupabaseClient, id: string, res: { changed: boolean; needs_refund: boolean }, refund: () => Promise<void>): Promise<RetreatResult> {
  const e = await loadEnquiry(db, id);
  if (res.needs_refund) {
    try { await refund(); } catch (err) {
      console.error("[retreat] automatic refund failed", err);
      await sendMail(adminNotice(`REFUND FAILED — refund manually (retreat deposit ${e?.reference ?? id})`, [`A retreat deposit arrived after the retreat was full, and the automatic refund failed.`, "Please refund it in your Stripe or PayPal dashboard."]));
      return { state: "refunded", enquiryId: id };
    }
    await db.from("retreat_enquiries").update({ payment_status: "refunded", status: "closed" }).eq("id", id); // never took places
    if (e) await sendMail(retreatDepositRefunded(mail(e, { refunded: formatPrice(e.deposit_cents, e.retreats?.currency) }), "The retreat filled up before your payment arrived, so your deposit has been refunded in full."));
    return { state: "refunded", enquiryId: id };
  }
  if (res.changed && e) {
    const paid = formatPrice(e.deposit_cents, e.retreats?.currency);
    await Promise.allSettled([sendMail(retreatDepositReceived(mail(e, { paid }))), sendMail(adminNotice(`Retreat deposit paid — ${e.retreats?.title} (${e.reference})`, [`${e.full_name} <${e.email}> paid ${paid} for ${e.participants} place(s).`, "Places have been reserved automatically."], e.email))]);
  }
  return { state: "confirmed", enquiryId: id };
}

export async function confirmRetreatStripe(db: SupabaseClient, stripe: Stripe, session: Stripe.Checkout.Session): Promise<RetreatResult> {
  const id = session.metadata?.enquiry_id;
  if (!id) throw new Error("Checkout session has no enquiry");
  if (session.payment_status !== "paid") return { state: "unpaid", enquiryId: id };
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const { data, error } = await db.rpc("confirm_retreat_deposit", { p_enquiry_id: id, p_provider: "stripe", p_ref: session.id, p_intent: intent, p_amount: session.amount_total });
  if (error) throw new Error(error.message);
  return finish(db, id, data as { changed: boolean; needs_refund: boolean }, async () => {
    if (intent) await stripe.refunds.create({ payment_intent: intent, metadata: { enquiry_id: id, why: "retreat full" } }, { idempotencyKey: `refund-retreat-${id}` });
  });
}

export async function confirmRetreatPayPal(db: SupabaseClient, orderId: string, id: string, currency: string): Promise<RetreatResult> {
  let order = await getOrder(orderId);
  if (order.status === "APPROVED") order = await captureOrder(orderId);
  const cap = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status !== "COMPLETED" || !cap || cap.status !== "COMPLETED") return { state: "unpaid", enquiryId: id };
  if (cap.amount.currency_code.toUpperCase() !== currency.toUpperCase()) throw new Error("PayPal currency mismatch");
  const { data, error } = await db.rpc("confirm_retreat_deposit", { p_enquiry_id: id, p_provider: "paypal", p_ref: orderId, p_intent: cap.id, p_amount: toCents(cap.amount.value) });
  if (error) throw new Error(error.message);
  return finish(db, id, data as { changed: boolean; needs_refund: boolean }, () => refundCapture(cap.id, id));
}

/** Admin action: refund a paid deposit in full (Stripe or PayPal) and release the places. */
export async function refundRetreatDeposit(db: SupabaseClient, stripe: Stripe | null, id: string): Promise<boolean> {
  const { data: e } = await db.from("retreat_enquiries").select("payment_status,payment_provider,stripe_payment_intent,paypal_capture_id").eq("id", id).maybeSingle();
  if (!e || e.payment_status !== "paid") return false;
  if (e.payment_provider === "paypal") {
    if (!e.paypal_capture_id) return false;
    await refundCapture(e.paypal_capture_id, id);
  } else {
    if (!e.stripe_payment_intent) return false;
    if (!stripe) throw new Error("Stripe is not configured, so this deposit cannot be refunded automatically");
    await stripe.refunds.create({ payment_intent: e.stripe_payment_intent, metadata: { enquiry_id: id } }, { idempotencyKey: `refund-retreat-${id}` });
  }
  const { data: ok } = await db.rpc("refund_retreat_deposit", { p_enquiry_id: id });
  const row = await loadEnquiry(db, id);
  if (row) await sendMail(retreatDepositRefunded(mail(row, { refunded: formatPrice(row.deposit_cents, row.retreats?.currency) }), "Your deposit has been refunded in full and your places released."));
  return Boolean(ok);
}
