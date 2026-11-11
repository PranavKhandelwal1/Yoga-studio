import Link from "next/link";
import { CheckCircle2, Clock, Video } from "lucide-react";
import { fmtDate, fmtTime } from "@/lib/utils/time";
import { formatPrice } from "@/lib/utils/format";

export type SuccessBooking = { reference: string; participants: number; status: string; payment_status: string; total_price_cents: number | null; currency: string; payment_provider?: string | null;
  class_sessions: { starts_at: string; ends_at: string; classes: { title: string; location_name: string | null; delivery?: string } | null } | null };

/** Shared confirmation screen for Stripe and PayPal returns. */
export function SuccessView({ booking }: { booking: SuccessBooking | null }) {
  const confirmed = booking?.status === "approved" && booking.payment_status === "paid";
  const s = booking?.class_sessions; const online = s?.classes?.delivery === "online";
  return (
    <section className="section"><div className="container-x max-w-3xl">
      {!booking ? (
        <div className="border border-sage/60 bg-white p-8"><p className="lead">We couldn&apos;t find that booking. If you were charged, you&apos;ll receive a confirmation email shortly — or <Link href="/contact" className="underline underline-offset-4">contact Angela</Link> with your payment receipt.</p></div>
      ) : (
        <div role="status" className="border border-forest/30 bg-white p-6 sm:p-8 md:p-12">
          {confirmed ? <CheckCircle2 className="text-forest" size={40} aria-hidden /> : <Clock className="text-forest" size={40} aria-hidden />}
          <h2 className="h-section mt-4">{confirmed ? "Payment received — your booking is confirmed" : "Almost there…"}</h2>
          <p className="lead mt-3">{confirmed ? "A confirmation email is on its way. Please keep your reference." : "Your payment is being processed. This page will show your confirmation once it completes; you'll also get an email. Refresh in a minute if nothing changes."}</p>
          {confirmed && online && <p className="mt-4 flex items-start gap-2 text-forest"><Video size={18} className="mt-1 shrink-0" aria-hidden />This is an online class — your private joining link is in the confirmation email.</p>}
          <dl className="mt-8 grid gap-x-8 gap-y-3 border-t border-sage/60 pt-6 sm:grid-cols-[10rem_1fr]">
            <dt className="text-ink-soft">Reference</dt><dd className="font-medium tracking-wider">{booking.reference}</dd>
            {s?.classes && <><dt className="text-ink-soft">Class</dt><dd>{s.classes.title}</dd></>}
            {s && <><dt className="text-ink-soft">When</dt><dd>{fmtDate(s.starts_at)}, {fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}</dd></>}
            {online ? <><dt className="text-ink-soft">Where</dt><dd>Online</dd></> : s?.classes?.location_name && <><dt className="text-ink-soft">Where</dt><dd>{s.classes.location_name}</dd></>}
            <dt className="text-ink-soft">Participants</dt><dd>{booking.participants}</dd>
            {confirmed && <><dt className="text-ink-soft">Paid</dt><dd>{formatPrice(booking.total_price_cents, booking.currency)}{booking.payment_provider === "paypal" ? " via PayPal" : ""}</dd></>}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/schedule" className="btn btn-outline">Back to schedule</Link><Link href="/book/lookup" className="btn btn-outline">Find my booking</Link><Link href="/" className="btn btn-primary">Home</Link></div>
        </div>
      )}
    </div></section>
  );
}
