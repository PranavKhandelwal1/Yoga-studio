import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/utils/origin";
import { getSettings } from "@/lib/content/get";
import { cancelHours } from "@/lib/booking/policy";
import { getStripe } from "@/lib/payments/stripe";
import { loadBooking, refundBooking, toMailData } from "@/lib/payments/checkout";
import { adminNotice, sendMail, visitorCancelled } from "@/lib/email/send";
import { formatPrice } from "@/lib/utils/format";

const schema = z.object({ reference: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,16}$/), email: z.string().trim().toLowerCase().email().max(254) });

/**
 * Guest self-cancellation. Needs BOTH the reference and the email. The cancellation window comes from the policy in
 * site settings and is enforced inside the database (customer_cancel_booking), so it can't be bypassed from the browser.
 * Paid bookings are refunded automatically.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await rateLimit("cancel", 6, 600))) return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your booking reference and the email you booked with." }, { status: 422 });

  const db = createAdminClient();
  const hours = cancelHours(await getSettings());
  const { data, error } = await db.rpc("customer_cancel_booking", { p_reference: parsed.data.reference, p_email: parsed.data.email, p_min_hours: hours });
  if (error) {
    const m = error.message;
    if (m.includes("BOOKING_NOT_FOUND")) return NextResponse.json({ error: "We couldn't find a booking with that reference and email." }, { status: 404 });
    if (m.includes("NOT_CANCELLABLE")) return NextResponse.json({ error: "This booking can't be cancelled any more." }, { status: 409 });
    if (m.includes("TOO_LATE")) return NextResponse.json({ error: `Online cancellation closes ${hours} hour${hours === 1 ? "" : "s"} before the class. Please contact us and we'll do our best to help.` }, { status: 409 });
    console.error("[cancel]", m);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const { booking_id, paid } = data as { booking_id: string; paid: boolean };
  let refunded = false; let refundFailed = false;
  if (paid) {
    try { refunded = await refundBooking(db, getStripe(), booking_id); } catch (e) { refundFailed = true; console.error("[cancel] refund failed", e); }
  }
  const b = await loadBooking(db, booking_id);
  if (b) {
    await Promise.allSettled([
      sendMail(visitorCancelled(toMailData(b, refunded ? { refunded: formatPrice(b.total_price_cents, b.currency) } : refundFailed ? { note: "We'll process your refund by hand and email you once it's done." } : {}))),
      sendMail(adminNotice(`Booking cancelled by guest — ${b.reference}${refundFailed ? " (REFUND FAILED — refund manually)" : ""}`, [`${b.full_name} <${b.email}> cancelled ${b.class_sessions?.classes?.title ?? "a class"}.`, refunded ? "The payment was refunded automatically." : refundFailed ? "The automatic refund failed — please refund this payment from Stripe/PayPal." : "No payment to refund."], b.email)),
    ]);
  }
  return NextResponse.json({ ok: true, refunded, refundFailed });
}
