import { PageHeader } from "@/components/ui/PageHeader";
import { BookingLookup } from "@/components/booking/BookingLookup";
import { buildMetadata } from "@/lib/seo";
import { getSettings } from "@/lib/content/get";
import { cancelHours } from "@/lib/booking/policy";

export const metadata = buildMetadata({ title: "Find my booking", description: "Check the status of your booking with your reference and email.", path: "/book/lookup" });

export const revalidate = 60;

export default async function LookupPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader eyebrow="Booking" title="Find my booking" subtitle="Enter the reference from your confirmation email and the email address you booked with." />
      <section className="section"><div className="container-x max-w-3xl"><BookingLookup cancelHours={cancelHours(settings)} policy={settings.booking.policy} /></div></section>
    </>
  );
}
