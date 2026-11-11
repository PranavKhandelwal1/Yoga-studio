import { NextResponse, type NextRequest } from "next/server";
import { bookingSchema } from "@/lib/validation/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { BOOKING_ERRORS, createBooking } from "@/lib/booking/service";
import { adminNewBooking, sendMail, visitorRequestReceived } from "@/lib/email/send";
import { sameOrigin } from "@/lib/utils/origin";
import { getStripe } from "@/lib/payments/stripe";
import { startCheckout, startPayPalCheckout } from "@/lib/payments/checkout";
import { payMethods } from "@/lib/payments/methods";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await rateLimit("booking", 5, 600))) {
    return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form.", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const input = parsed.data;
  // Honeypot tripped: pretend success so bots learn nothing.
  if (input.website) return NextResponse.json({ ok: true, reference: "00000000" });

  const db = createAdminClient();
  await db.rpc("release_stale_unpaid_bookings", { p_minutes: 35 }); // free seats from abandoned payments (ignored if it fails)
  const result = await createBooking(db, input);
  if (!result.ok) {
    const e = BOOKING_ERRORS[result.code];
    return NextResponse.json({ error: e.message, code: result.code }, { status: e.status });
  }

  // Pay first: a booking with a price is held (PENDING) while the visitor pays on Stripe's or PayPal's secure page.
  // It is confirmed automatically once the payment is verified server-side — never before.
  const { data: row } = await db.from("bookings").select("payment_status").eq("id", result.bookingId).single();
  const methods = payMethods();
  if (row?.payment_status === "unpaid" && methods.length) {
    const method = input.paymentMethod && methods.includes(input.paymentMethod) ? input.paymentMethod : methods[0];
    try {
      const checkoutUrl = method === "paypal" ? await startPayPalCheckout(db, result.bookingId) : await startCheckout(db, getStripe()!, result.bookingId);
      return NextResponse.json({ ok: true, reference: result.reference, status: "awaiting_payment", checkoutUrl }, { status: 201 });
    } catch (e) {
      console.error(`[${method}] could not start checkout:`, e);
      await db.rpc("release_unpaid_booking", { p_booking_id: result.bookingId }); // free the seats again
      return NextResponse.json({ error: "We couldn't start the payment. Please try again in a moment." }, { status: 502 });
    }
  }
  if (row?.payment_status === "unpaid") console.warn("[payments] no payment provider configured — booking left PENDING for manual approval");

  // Free / price-on-request (or payments not configured): classic request → admin approval flow.
  // Notifications must never fail the booking.
  const { data: s } = await db.from("class_sessions")
    .select("starts_at, location_override, classes(title, location_name)").eq("id", input.sessionId).single();
  const cls = (s as unknown as { classes: { title: string; location_name: string | null } } | null)?.classes;
  if (s && cls) {
    const mail = {
      reference: result.reference, fullName: input.fullName, email: input.email, participants: input.participants,
      className: cls.title, startsAt: s.starts_at, location: s.location_override ?? cls.location_name, message: input.message,
    };
    await Promise.allSettled([sendMail(visitorRequestReceived(mail)), sendMail(adminNewBooking(mail))]);
  }

  return NextResponse.json({ ok: true, reference: result.reference, status: "pending" }, { status: 201 });
}
