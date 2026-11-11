import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, MapPin, User, Video } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { ButtonLink } from "@/components/ui/Button";
import { getAvailability, getClass } from "@/lib/data/queries";
import { getSettings } from "@/lib/content/get";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata, jsonLd } from "@/lib/seo";
import { formatPrice, SITE_URL } from "@/lib/utils/format";
import { fmtDate, fmtTime, formatMinutes } from "@/lib/utils/time";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const c = await getClass((await params).slug);
  if (!c) return {};
  return buildMetadata({ title: c.seo_title ?? c.title, description: c.seo_description ?? c.summary, path: `/classes/${c.slug}`, image: c.image_url });
}

export default async function ClassPage({ params }: Props) {
  const { slug } = await params;
  const [c, settings] = await Promise.all([getClass(slug), getSettings()]);
  if (!c) notFound();
  const now = new Date();
  const sessions = (await getAvailability(now, new Date(+now + 90 * 864e5))).filter((s) => s.class_id === c.id);
  const ld = { "@context": "https://schema.org", "@type": "Course", name: c.title, description: c.summary ?? c.description ?? undefined, provider: { "@type": "Organization", name: settings.general.site_name, url: SITE_URL },
    offers: c.price_cents != null ? { "@type": "Offer", price: c.price_cents / 100, priceCurrency: c.currency } : undefined };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <article className="section"><div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-soft"><Link href="/classes" className="hover:underline">Classes</Link> / {c.title}</nav>
          {c.style && <p className="eyebrow mb-3">{c.style}</p>}
          <h1 className="h-display !text-[clamp(2.75rem,6vw,5rem)]">{c.title}</h1>
          {c.summary && <p className="lead mt-5">{c.summary}</p>}
          {c.image_url && <div className="relative mt-10 aspect-[3/2] overflow-hidden bg-sage/25"><SmartImage src={c.image_url} alt={c.image_alt ?? c.title} fill priority sizes="(min-width:1024px) 58vw, 100vw" className="object-cover" /></div>}
          {c.description && <div className="prose-yoga mt-10" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.description) }} />}
          {(c.teacher_name || c.teacher_bio) && (
            <section className="mt-12 border-t border-forest/40 pt-6"><h2 className="h-sub">Your teacher</h2><p className="mt-3 font-medium">{c.teacher_name}</p>{c.teacher_bio && <p className="mt-2 text-ink-soft">{c.teacher_bio}</p>}</section>
          )}
        </div>
        <aside className="lg:col-span-5"><div className="border border-sage/70 bg-white p-6 md:p-8 lg:sticky lg:top-28">
          <p className="font-serif text-4xl text-deep">{formatPrice(c.price_cents, c.currency)}<span className="ml-2 font-sans text-sm text-ink-soft">per person</span></p>
          <ul className="mt-5 space-y-2.5 text-ink-soft">
            <li className="flex items-center gap-3"><Clock size={18} />{formatMinutes(c.duration_minutes)}</li>
            {c.delivery === "online" ? <li className="flex gap-3 font-medium text-forest"><Video size={18} className="mt-1 shrink-0" /><span>Online class — live video. The joining link is emailed once your booking is confirmed.</span></li> : (c.location_name || c.location_address) && <li className="flex gap-3"><MapPin size={18} className="mt-1 shrink-0" /><span>{c.location_name}{c.location_address && <><br />{c.location_address}</>}</span></li>}
            {c.teacher_name && <li className="flex items-center gap-3"><User size={18} />{c.teacher_name}</li>}
          </ul>
          <h2 className="mt-8 font-serif text-2xl text-deep">Available dates</h2>
          {sessions.length === 0 ? <p className="mt-2 text-ink-soft">No dates scheduled yet. <Link href="/contact" className="underline underline-offset-4">Ask Angela</Link>.</p> : (
            <ul className="mt-3 divide-y divide-sage/50">
              {sessions.slice(0, 8).map((s) => {
                const ok = s.status === "scheduled" && s.seats_left > 0;
                return (
                  <li key={s.session_id} className={`flex items-center justify-between gap-3 py-3 ${s.status === "cancelled" ? "opacity-60" : ""}`}>
                    <div><p className={`font-medium ${s.status === "cancelled" ? "line-through" : ""}`}>{fmtDate(s.starts_at, { year: undefined })}</p><p className="text-sm text-ink-soft">{fmtTime(s.starts_at)}–{fmtTime(s.ends_at)} · {s.status === "cancelled" ? "Cancelled" : s.seats_left > 0 ? `${s.seats_left} left` : "Full"}</p></div>
                    {ok && <Link href={`/book?session=${s.session_id}`} className="btn btn-primary btn-sm">Book</Link>}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap gap-3"><ButtonLink href={`/book?class=${c.slug}`}>Request a booking</ButtonLink><ButtonLink href="/schedule" variant="outline">Schedule</ButtonLink></div>
          <p className="mt-4 text-xs text-ink-soft">Times are Mallorca local time. {settings.booking.policy}</p>
        </div></aside>
      </div></article>
    </>
  );
}
