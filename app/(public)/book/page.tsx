import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { BookingForm, type BookClass, type BookSession } from "@/components/booking/BookingForm";
import { getAvailability, getClasses } from "@/lib/data/queries";
import { buildMetadata } from "@/lib/seo";
import { ButtonLink } from "@/components/ui/Button";
import { payMethods } from "@/lib/payments/methods";
import { getSettings } from "@/lib/content/get";

export const dynamic = "force-dynamic"; // seat counts must be live
export const metadata = buildMetadata({ title: "Book a class", description: "Request a booking for a yoga class with Angela in Mallorca.", path: "/book" });

export default async function BookPage({ searchParams }: { searchParams: Promise<{ session?: string; class?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const [classes, avail, settings] = await Promise.all([getClasses(), getAvailability(now, new Date(+now + 120 * 864e5)), getSettings()]);
  const bookClasses: BookClass[] = classes.map((c) => ({ id: c.id, slug: c.slug, title: c.title, price_cents: c.price_cents, currency: c.currency, duration_minutes: c.duration_minutes, location: c.location_name, online: c.delivery === "online" }));
  const sessions: BookSession[] = avail.filter((s) => s.status === "scheduled" && new Date(s.starts_at) > now).map((s) => ({ id: s.session_id, classId: s.class_id, startsAt: s.starts_at, endsAt: s.ends_at, seatsLeft: s.seats_left }));
  const hasDates = sessions.length > 0;
  const methods = payMethods();
  const payOnline = methods.length > 0;
  return (
    <>
      <PageHeader eyebrow="Booking" title="Book a class" subtitle={payOnline ? "Choose a class and date, pay securely online, and your place is confirmed instantly — you'll receive a confirmation email." : "Choose a class and date and send a request. Angela confirms each booking personally — you'll receive an email once it's approved."} />
      <section className="section"><div className="container-x max-w-3xl">
        <p className="mb-8 text-sm text-ink-soft">Already booked? <Link href="/book/lookup" className="underline underline-offset-4">Find my booking</Link></p>
        {!hasDates ? (
          <div className="border border-sage/60 bg-white/50 p-10 text-center"><p className="font-serif text-3xl text-deep">There are no bookable classes right now.</p><p className="mt-3 text-ink-soft">New dates are added regularly. Get in touch to ask about availability.</p><div className="mt-6"><ButtonLink href="/contact">Contact Angela</ButtonLink></div></div>
        ) : <BookingForm classes={bookClasses} sessions={sessions} initialSessionId={sp.session} initialClassSlug={sp.class} payMethods={methods} />}
        <p className="mt-10 border-t border-line pt-6 text-sm text-ink-soft"><strong className="font-medium text-deep">Cancellation.</strong> {settings.booking.policy}</p>
      </div></section>
    </>
  );
}
