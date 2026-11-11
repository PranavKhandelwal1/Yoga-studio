import { PageHeader } from "@/components/ui/PageHeader";
import { ScheduleCalendar, type CalSession } from "@/components/classes/ScheduleCalendar";
import { getAvailability, getClasses } from "@/lib/data/queries";
import { getSettings } from "@/lib/content/get";
import { buildMetadata } from "@/lib/seo";
import { madridDateKey } from "@/lib/utils/time";

export const revalidate = 60;
export const metadata = buildMetadata({ title: "Class schedule", description: "Weekly and monthly yoga class schedule in Mallorca with live availability. All times Mallorca local.", path: "/schedule" });

export default async function SchedulePage() {
  const now = new Date();
  // Include the start of the current month so the month view is complete.
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 2 * 864e5);
  const [classes, avail, settings] = await Promise.all([getClasses(), getAvailability(from, new Date(+now + 180 * 864e5)), getSettings()]);
  const byId = new Map(classes.map((c) => [c.id, c]));
  const sessions: CalSession[] = avail.flatMap((s) => {
    const c = byId.get(s.class_id);
    if (!c) return [];
    return [{ id: s.session_id, classSlug: c.slug, classTitle: c.title, startsAt: s.starts_at, endsAt: s.ends_at, seatsLeft: s.seats_left, capacity: s.capacity, cancelled: s.status === "cancelled", location: s.location_override ?? c.location_name, online: c.delivery === "online" }];
  });
  return (
    <>
      <PageHeader eyebrow="Schedule" title="Class schedule" subtitle={settings.schedule_note.text} />
      <section className="section"><div className="container-x"><ScheduleCalendar sessions={sessions} todayKey={madridDateKey(now)} nowMs={now.getTime()} /></div></section>
    </>
  );
}
