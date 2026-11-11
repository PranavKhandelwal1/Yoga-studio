import { PageHeader } from "@/components/ui/PageHeader";
import { SuccessView, type SuccessBooking } from "@/components/booking/SuccessView";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmPayPalOrder } from "@/lib/payments/checkout";
import { paypalEnabled } from "@/lib/payments/paypal";
import { RetreatDepositView, type DepositView } from "@/components/booking/RetreatDepositView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking confirmed", robots: { index: false, follow: false } };
const SELECT = "reference,participants,status,payment_status,payment_provider,total_price_cents,currency,class_sessions(starts_at,ends_at,classes(title,location_name,delivery))";

const DEP = "reference,participants,payment_status,status,deposit_cents,payment_provider,retreats(title,slug,currency,start_date,end_date,location)";
/** PayPal sends the visitor here with ?token=<orderId>. We capture + verify on the server; nothing is trusted from the URL beyond the order id. */
export default async function PayPalReturn({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let booking = null as SuccessBooking | null; let deposit = null as DepositView | null;
  if (token && /^[A-Z0-9]{10,40}$/.test(token) && paypalEnabled()) {
    try {
      const db = createAdminClient();
      await confirmPayPalOrder(db, token).catch((e) => console.error("[paypal return] confirm failed", e));
      const { data } = await db.from("bookings").select(SELECT).eq("paypal_order_id", token).maybeSingle();
      booking = data as unknown as SuccessBooking | null;
      if (!booking) { const { data: d } = await db.from("retreat_enquiries").select(DEP).eq("paypal_order_id", token).maybeSingle(); deposit = d as unknown as DepositView | null; }
    } catch (e) { console.error("[paypal return]", e); }
  }
  if (deposit) return (<><PageHeader eyebrow="Retreat" title={deposit.payment_status === "paid" ? "You're on the retreat" : "Confirming your payment"} /><RetreatDepositView e={deposit} /></>);
  const confirmed = booking?.status === "approved" && booking.payment_status === "paid";
  return (<><PageHeader eyebrow="Booking" title={confirmed ? "You're booked" : "Confirming your payment"} /><SuccessView booking={booking} /></>);
}
