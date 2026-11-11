import { PageHeader } from "@/components/ui/PageHeader";
import { SuccessView, type SuccessBooking } from "@/components/booking/SuccessView";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/payments/stripe";
import { confirmCheckoutSession } from "@/lib/payments/checkout";
import { RetreatDepositView, type DepositView } from "@/components/booking/RetreatDepositView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking confirmed", robots: { index: false, follow: false } };

const SELECT = "reference,participants,status,payment_status,payment_provider,total_price_cents,currency,class_sessions(starts_at,ends_at,classes(title,location_name,delivery))";

const DEP = "reference,participants,payment_status,status,deposit_cents,payment_provider,retreats(title,slug,currency,start_date,end_date,location)";
export default async function Success({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const valid = session_id && /^cs_[A-Za-z0-9_]{10,200}$/.test(session_id);
  let booking = null as SuccessBooking | null; let deposit = null as DepositView | null;
  if (valid) {
    try {
      const db = createAdminClient(); const stripe = getStripe();
      if (stripe) await confirmCheckoutSession(db, stripe, session_id).catch((e) => console.error("[success page] confirm failed", e)); // idempotent; the webhook may also do this
      const { data } = await db.from("bookings").select(SELECT).eq("stripe_session_id", session_id).maybeSingle();
      booking = data as unknown as SuccessBooking | null;
      if (!booking) { const { data: d } = await db.from("retreat_enquiries").select(DEP).eq("stripe_session_id", session_id).maybeSingle(); deposit = d as unknown as DepositView | null; }
    } catch (e) { console.error("[success page]", e); }
  }
  if (deposit) return (<><PageHeader eyebrow="Retreat" title={deposit.payment_status === "paid" ? "You're on the retreat" : "Confirming your payment"} /><RetreatDepositView e={deposit} /></>);
  const confirmed = booking?.status === "approved" && booking.payment_status === "paid";
  return (<><PageHeader eyebrow="Booking" title={confirmed ? "You're booked" : "Confirming your payment"} /><SuccessView booking={booking} /></>);
}
