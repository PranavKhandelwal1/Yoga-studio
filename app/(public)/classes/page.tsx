import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClassCard } from "@/components/classes/ClassCard";
import { ButtonLink } from "@/components/ui/Button";
import { getAvailability, getClasses } from "@/lib/data/queries";
import { getSettings } from "@/lib/content/get";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Yoga classes in Mallorca", description: "Group yoga classes with Angela in Puerto Portals, Mallorca. See class styles, durations, prices and upcoming dates, and request a booking online.", path: "/classes" });

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const { format } = await searchParams;
  const now = new Date();
  const [classes, avail, settings] = await Promise.all([getClasses(), getAvailability(now, new Date(+now + 60 * 864e5)), getSettings()]);
  const shown = format === "online" ? classes.filter((c) => c.delivery === "online") : format === "in-person" ? classes.filter((c) => c.delivery !== "online") : classes;
  const mixed = classes.some((c) => c.delivery === "online") && classes.some((c) => c.delivery !== "online");
  const next = (id: string) => avail.filter((s) => s.class_id === id && s.status === "scheduled" && s.seats_left > 0);
  return (
    <>
      <PageHeader eyebrow="Classes" title="Yoga classes" subtitle={settings.schedule_note.text} />
      <section className="section"><div className="container-x">
        {classes.length === 0 ? (
          <div className="border border-sage/60 bg-white/50 p-10 text-center"><p className="font-serif text-3xl text-deep">Classes will be announced soon.</p><p className="mt-3 text-ink-soft">Get in touch to ask about the current schedule.</p><div className="mt-6"><ButtonLink href="/contact">Contact Angela</ButtonLink></div></div>
        ) : <>
          {mixed && (
            <nav aria-label="Class format" className="mb-10 flex flex-wrap gap-2">
              {[["", "All classes"], ["in-person", "In person"], ["online", "Online"]].map(([v, l]) => (
                <Link key={v} href={v ? `/classes?format=${v}` : "/classes"} aria-current={(format ?? "") === v ? "true" : undefined} className={`flex min-h-11 items-center border px-4 text-[0.8125rem] ${(format ?? "") === v ? "border-deep bg-deep text-cream" : "border-sage hover:bg-sage/30"}`}>{l}</Link>
              ))}
            </nav>
          )}
          <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">{shown.map((c) => <ClassCard key={c.id} c={c} next={next(c.id)} />)}</div></>}
      </div></section>
      <section className="section-bone border-t border-line py-16 md:py-24"><div className="container-x flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-xl"><p className="eyebrow mb-3">One to one</p><h2 className="h-section">Prefer a private session?</h2><p className="lead mt-4">Practise at your own pace, in person or online, at a time that suits you.</p></div>
        <Link href="/private" className="link-arrow">Request a private session</Link>
      </div></section>
    </>
  );
}
