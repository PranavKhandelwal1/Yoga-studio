import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";

export type DepositView = { reference: string; participants: number; payment_status: string; status: string; deposit_cents: number | null; payment_provider: string | null; retreats: { title: string; slug: string; currency: string; start_date: string | null; end_date: string | null; location: string | null } | null };

/** Confirmation screen after paying a retreat deposit (Stripe or PayPal). */
export function RetreatDepositView({ e }: { e: DepositView }) {
  const paid = e.payment_status === "paid" && e.status === "confirmed";
  const r = e.retreats;
  return (
    <section className="section"><div className="container-x max-w-3xl">
      <div role="status" className="border border-line bg-bone p-6 sm:p-8 md:p-12">
        {paid ? <CheckCircle2 className="text-forest" size={40} aria-hidden /> : <Clock className="text-forest" size={40} aria-hidden />}
        <h2 className="h-section mt-4">{paid ? "Deposit received — your place is reserved" : e.payment_status === "refunded" ? "Your deposit was refunded" : "Almost there…"}</h2>
        <p className="lead mt-3">{paid ? "A confirmation email is on its way. Angela will contact you about the balance and next steps." : e.payment_status === "refunded" ? "The retreat filled up before your payment arrived, so you've been refunded in full." : "Your payment is being processed. Refresh this page in a moment."}</p>
        <dl className="mt-8 grid gap-x-8 gap-y-3 border-t border-line pt-6 sm:grid-cols-[10rem_1fr]">
          <dt className="text-ink-soft">Reference</dt><dd className="font-medium tracking-wider">{e.reference}</dd>
          {r && <><dt className="text-ink-soft">Retreat</dt><dd>{r.title}</dd></>}
          {r?.start_date && <><dt className="text-ink-soft">Dates</dt><dd>{[r.start_date, r.end_date].filter(Boolean).join(" → ")}</dd></>}
          {r?.location && <><dt className="text-ink-soft">Where</dt><dd>{r.location}</dd></>}
          <dt className="text-ink-soft">Places</dt><dd>{e.participants}</dd>
          {paid && <><dt className="text-ink-soft">Deposit paid</dt><dd>{formatPrice(e.deposit_cents, r?.currency)}{e.payment_provider === "paypal" ? " via PayPal" : ""}</dd></>}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">{r && <Link href={`/retreats/${r.slug}`} className="btn btn-outline">Back to the retreat</Link>}<Link href="/retreats" className="btn btn-outline">All retreats</Link></div>
      </div>
    </div></section>
  );
}
