import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { payMethods } from "@/lib/payments/methods";
import { EnquiryForm } from "@/components/retreats/EnquiryForm";
import { getRetreat } from "@/lib/data/queries";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata, jsonLd } from "@/lib/seo";
import { formatPrice, SITE_URL } from "@/lib/utils/format";
import { placesLeft, retreatDates, retreatDuration } from "@/lib/utils/retreat";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const r = await getRetreat((await params).slug);
  if (!r) return {};
  return buildMetadata({ title: r.seo_title ?? r.title, description: r.seo_description ?? r.summary, path: `/retreats/${r.slug}`, image: r.hero_image_url });
}

export default async function RetreatPage({ params }: Props) {
  const r = await getRetreat((await params).slug);
  if (!r) notFound();
  const left = placesLeft(r);
  const full = left === 0;
  const duration = retreatDuration(r);
  const ld = { "@context": "https://schema.org", "@type": "Event", name: r.title, description: r.summary ?? undefined, startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: r.location ? { "@type": "Place", name: r.location } : undefined, image: r.hero_image_url ?? undefined,
    offers: r.price_cents != null ? { "@type": "Offer", price: r.price_cents / 100, priceCurrency: r.currency, availability: full ? "https://schema.org/SoldOut" : "https://schema.org/InStock", url: `${SITE_URL}/retreats/${r.slug}` } : undefined };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <article>
        <div className="relative h-[52svh] min-h-[22rem] w-full bg-deep">
          <SmartImage src={r.hero_image_url ?? ""} alt={r.hero_image_alt ?? r.title} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-deep/40" aria-hidden />
          <div className="container-x absolute inset-x-0 bottom-0 pb-10 text-cream"><nav aria-label="Breadcrumb" className="mb-3 text-sm text-cream/85"><Link href="/retreats" className="hover:underline">Retreats</Link> / {r.title}</nav><h1 className="h-display !text-cream !text-[clamp(2.75rem,6vw,5rem)]">{r.title}</h1></div>
        </div>
        <div className="section"><div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            {r.summary && <p className="font-serif text-3xl leading-snug text-deep">{r.summary}</p>}
            {r.description && <div className="prose-yoga mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.description) }} />}
            {r.programme?.length > 0 && (
              <section className="mt-14" aria-labelledby="prog"><h2 id="prog" className="h-section">Programme</h2>
                <ol className="mt-8 divide-y divide-sage/50 border-y border-sage/50">
                  {r.programme.map((p, i) => <li key={i} className="grid gap-2 py-6 md:grid-cols-[12rem_1fr]"><h3 className="font-serif text-2xl text-deep">{p.title}</h3><p className="whitespace-pre-line text-ink-soft">{p.description}</p></li>)}
                </ol>
              </section>
            )}
            {r.gallery?.length > 0 && (
              <section className="mt-14" aria-label="Photographs"><div className="grid gap-4 sm:grid-cols-2">{r.gallery.map((g, i) => <div key={i} className="relative aspect-[4/3] overflow-hidden bg-sage/25"><SmartImage src={g.url} alt={g.alt || r.title} fill sizes="(min-width:1024px) 29vw, 100vw" className="object-cover" /></div>)}</div></section>
            )}
          </div>
          <aside className="lg:col-span-5"><div className="border border-sage/70 bg-white p-6 md:p-8 lg:sticky lg:top-28">
            <p className="font-serif text-4xl text-deep">{formatPrice(r.price_cents, r.currency)}</p>
            <ul className="mt-5 space-y-2.5 text-ink-soft">
              <li className="flex items-center gap-3"><CalendarDays size={18} />{retreatDates(r)}{duration && ` · ${duration}`}</li>
              {r.location && <li className="flex items-center gap-3"><MapPin size={18} />{r.location}</li>}
              {left !== null && <li className="flex items-center gap-3"><Users size={18} />{full ? "Fully booked — enquire to join the waiting list" : `${left} ${left === 1 ? "place" : "places"} available`}</li>}
            </ul>
            <h2 className="mt-8 font-serif text-2xl text-deep">{full ? "Enquire" : "Enquire or request a place"}</h2>
            <div className="mt-4"><EnquiryForm retreatId={r.id} retreatTitle={r.title} canBook={!full} maxParticipants={left ?? 10} deposit={r.deposit_cents ? { perPersonCents: r.deposit_cents, currency: r.currency } : null} methods={payMethods()} /></div>
          </div></aside>
        </div></div>
      </article>
    </>
  );
}
