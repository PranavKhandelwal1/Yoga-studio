import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment cancelled", robots: { index: false, follow: false } };

export default async function Cancelled({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  if (ref && /^[A-Z0-9]{6,16}$/.test(ref)) {
    try { // Release the held places right away so the visitor can try again. Only ever affects an UNPAID, PENDING booking.
      const db = createAdminClient();
      const { data } = await db.from("bookings").select("id").eq("reference", ref).maybeSingle();
      if (data) await db.rpc("release_unpaid_booking", { p_booking_id: data.id });
    } catch (e) { console.error("[cancel page]", e); }
  }
  return (
    <>
      <PageHeader eyebrow="Booking" title="Payment not completed" />
      <section className="section"><div className="container-x max-w-3xl">
        <div className="border border-sage/60 bg-white p-8 md:p-12">
          <p className="lead">No payment was taken and your booking was not confirmed. Your places have been released.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/book" className="btn btn-primary">Book again</Link><Link href="/contact" className="btn btn-outline">Need help?</Link></div>
        </div>
      </div></section>
    </>
  );
}
