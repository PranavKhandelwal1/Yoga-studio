import Link from "next/link";
import { ArrowRight, CalendarCheck, Feather, Heart, Mountain, Waves } from "lucide-react";
import { IconRing, Lotus, LotusDivider, Sunrise } from "@/components/ui/YogaIcons";
import { SmartImage } from "@/components/ui/SmartImage";
import { HalfMoons } from "@/components/ui/HalfMoons";
import { Reveal } from "@/components/ui/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { NewsletterForm } from "@/components/ui/NewsletterForm";
import { ClassCard } from "@/components/classes/ClassCard";
import { RetreatCard } from "@/components/retreats/RetreatCard";
import { PostCard } from "@/components/journal/PostCard";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { getPage, getSettings, isOn } from "@/lib/content/get";
import { getAvailability, getClasses, getGallery, getPosts, getRetreats, getTestimonials } from "@/lib/data/queries";
import { buildMetadata, jsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/utils/format";

export const revalidate = 60;

export async function generateMetadata() {
  const p = await getPage("home");
  return buildMetadata({ title: p.seo_title ?? undefined, description: p.seo_description, path: "/", image: p.og_image_url ?? p.content.hero_image });
}

function Eyebrow({ icon, children, className = "mb-5" }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <p className={`eyebrow flex items-center ${className}`}>{icon && <span aria-hidden className="mr-2.5 text-gold">{icon}</span>}{children}</p>;
}

function Heading({ eyebrow, title, body, icon }: { eyebrow?: string; title: string; body?: string; icon?: React.ReactNode }) {
  return (
    <Reveal className="max-w-2xl">
      {eyebrow && <Eyebrow icon={icon}>{eyebrow}</Eyebrow>}
      <h2 className="h-section">{title}</h2>
      {body && <p className="lead mt-5">{body}</p>}
    </Reveal>
  );
}

export default async function HomePage() {
  const [page, settings, classes, retreats, gallery, { posts }, testimonials] = await Promise.all([
    getPage("home"), getSettings(), getClasses(), getRetreats({ limit: 2 }), getGallery(6), getPosts({ limit: 3 }), getTestimonials(),
  ]);
  const c = page.content;
  const now = new Date();
  const avail = await getAvailability(now, new Date(now.getTime() + 45 * 864e5));
  const upcoming = (id: string) => avail.filter((s) => s.class_id === id && s.status === "scheduled" && s.seats_left > 0);
  const { contact, general } = settings;

  const ld = {
    "@context": "https://schema.org", "@type": "SportsActivityLocation", name: general.site_name, url: SITE_URL,
    description: page.seo_description ?? undefined, telephone: contact.phone, email: contact.email,
    address: { "@type": "PostalAddress", streetAddress: contact.studio_address, addressCountry: "ES" },
    sameAs: Object.values(settings.social).filter(Boolean),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />

      {isOn(c, "hero_visible") && (
        <section className="surface-dark relative overflow-hidden" aria-labelledby="hero-title">
          <div aria-hidden className="glow -right-32 -top-40 h-[40rem] w-[40rem]" />
          <div aria-hidden className="glow -bottom-48 -left-40 h-[30rem] w-[30rem] opacity-50" />
          <div className="container-x relative grid items-center gap-12 pb-16 pt-10 md:grid-cols-12 md:gap-8 md:pb-24 md:pt-16 lg:min-h-[calc(100svh-6rem)]">
            <Reveal className="md:col-span-7 lg:pr-10">
              {c.hero_eyebrow && <p className="eyebrow mb-6">{c.hero_eyebrow}</p>}
              <h1 id="hero-title" className="h-display">{c.hero_title}</h1>
              {c.hero_subtitle && <p className="mt-7 max-w-md font-serif text-2xl font-light italic text-sage md:text-[1.75rem]">{c.hero_subtitle}</p>}
              <div className="mt-11 flex flex-wrap items-center gap-x-8 gap-y-4">
                {c.hero_cta_label && <ButtonLink href={c.hero_cta_href || "/schedule"}>{c.hero_cta_label}</ButtonLink>}
                {c.hero_cta2_label && <Link href={c.hero_cta2_href || "/book"} className="link-arrow">{c.hero_cta2_label}</Link>}
              </div>
              <HalfMoons onDark className="mt-14 h-9 opacity-90 md:mt-20" />
            </Reveal>
            {/* The arch window with a sunrise disc behind it — the signature shape of the site. */}
            <Reveal delay={0.15} className="relative mx-auto w-full max-w-sm md:col-span-5 md:max-w-none">
              <div aria-hidden className="absolute -right-10 -top-8 aspect-square w-3/5 rounded-full bg-gold md:-right-16" />
              <div className="photo photo-arch relative aspect-[3/4] w-full"><SmartImage src={c.hero_image} alt={c.hero_image_alt} fill priority sizes="(min-width:768px) 40vw, 90vw" className="object-cover object-top" /></div>
            </Reveal>
          </div>
        </section>
      )}

      {isOn(c, "intro_visible") && (
        <section className="section"><div className="container-x grid gap-8 md:grid-cols-12">
          <Reveal className="md:col-span-5"><h2 className="h-section">{c.intro_heading}</h2><HalfMoons className="mt-10 h-14" /></Reveal>
          <Reveal delay={0.1} className="md:col-span-6 md:col-start-7"><p className="font-serif text-[1.65rem] font-light leading-[1.4] text-deep md:text-[2rem]">{c.intro_body}</p></Reveal>
        </div></section>
      )}

      {isOn(c, "classes_visible") && (
        <section className="section-bone section" aria-labelledby="classes-h"><div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div id="classes-h"><Heading icon={<Lotus size={20} />} eyebrow={c.classes_eyebrow} title={c.classes_heading} body={c.classes_body} /></div>
            <Link href="/schedule" className="link-arrow">Full schedule</Link>
          </div>
          {classes.length === 0 ? (
            <p className="mt-14 border-t border-line pt-8 text-ink-soft">Classes will be announced soon. See the <Link href="/schedule" className="underline underline-offset-4">schedule</Link> or <Link href="/contact" className="underline underline-offset-4">get in touch</Link>.</p>
          ) : (
            <div className="mt-16 grid gap-x-10 gap-y-20 sm:grid-cols-2 lg:grid-cols-3">{classes.slice(0, 3).map((k) => <Reveal key={k.id}><ClassCard c={k} next={upcoming(k.id)} /></Reveal>)}</div>
          )}
        </div></section>
      )}

      {isOn(c, "retreats_visible") && (
        <section className="section" aria-labelledby="retreats-h"><div className="container-x">
          <Reveal className="max-w-2xl">
            <Eyebrow icon={<Mountain size={19} />}>{c.retreats_eyebrow}</Eyebrow>
            <h2 id="retreats-h" className="h-section">{c.retreats_heading}</h2>
            <p className="lead mt-6">{c.retreats_body}</p>
          </Reveal>
          {retreats.length === 0 ? (
            <div className="mt-14 grid items-center gap-10 border-t border-line pt-12 md:grid-cols-2 md:gap-16">
              <p className="font-serif text-3xl font-light leading-snug text-deep">{c.retreats_empty}</p>
              <NewsletterForm source="home-retreats" />
            </div>
          ) : (
            <div className="mt-16 space-y-24">
              {retreats.map((r) => <Reveal key={r.id}><RetreatCard r={r} /></Reveal>)}
              <Link href="/retreats" className="link-arrow">All retreats</Link>
            </div>
          )}
        </div></section>
      )}

      {isOn(c, "about_visible") && (
        <section className="section section-bone" aria-labelledby="about-h"><div className="container-x grid items-center gap-10 md:grid-cols-12 md:gap-16">
          <Reveal className="md:col-span-5"><div className="photo photo-arch aspect-[4/5]"><SmartImage src={c.about_image} alt={c.about_image_alt} fill sizes="(min-width:768px) 40vw, 100vw" className="object-cover" /></div></Reveal>
          <Reveal delay={0.1} className="md:col-span-6 md:col-start-7">
            <Eyebrow icon={<Heart size={18} />}>{c.about_eyebrow}</Eyebrow>
            <h2 id="about-h" className="h-section">{c.about_heading}</h2>
            {c.about_body && <p className="lead mt-6 whitespace-pre-line">{c.about_body}</p>}
            <div className="mt-10"><Link href="/about" className="link-arrow">{c.about_cta_label || "More about Angela"}</Link></div>
          </Reveal>
        </div></section>
      )}

      {isOn(c, "philosophy_visible") && (
        <section className="section surface-dark relative overflow-hidden" aria-labelledby="phil-h"><div aria-hidden className="glow -left-40 top-10 h-[28rem] w-[28rem] opacity-40" /><div className="container-x relative">
          <div id="phil-h"><Heading icon={<Sunrise size={20} />} eyebrow={c.philosophy_eyebrow} title={c.philosophy_heading} body={c.philosophy_body} /></div>
          <dl className="mt-20 grid gap-12 md:grid-cols-3 md:gap-14">
            {[1, 2, 3].filter((n) => c[`benefit${n}_title`]).map((n) => (
              <Reveal key={n} delay={n * 0.08}><div className="border-t border-gold/70 pt-8"><IconRing>{[<Mountain key="m" size={24} />, <Waves key="w" size={24} />, <Lotus key="l" size={26} />][n - 1]}</IconRing><dt className="h-sub mt-5">{c[`benefit${n}_title`]}</dt><dd className="mt-3 text-ink-soft">{c[`benefit${n}_text`]}</dd></div></Reveal>
            ))}
          </dl>
        </div></section>
      )}

      {isOn(c, "gallery_visible") && gallery.length > 0 && (
        <section className="section section-bone" aria-labelledby="gal-h"><div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6"><div id="gal-h"><Heading icon={<Heart size={18} />} eyebrow={c.gallery_eyebrow} title={c.gallery_heading} /></div><Link href="/gallery" className="link-arrow">View gallery</Link></div>
          <div className="mt-14"><GalleryGrid items={gallery} filters={false} /></div>
        </div></section>
      )}

      {isOn(c, "testimonials_visible") && testimonials.length > 0 && (
        <section className="section" aria-labelledby="test-h"><div className="container-x">
          <h2 id="test-h" className="h-section">{c.testimonials_heading}</h2>
          <div className="mt-16 grid gap-14 md:grid-cols-2">
            {testimonials.slice(0, 4).map((t) => (
              <Reveal key={t.id}><figure className="border-l border-deep pl-8"><blockquote className="font-serif text-[1.75rem] font-light italic leading-snug text-deep">“{t.quote}”</blockquote><figcaption className="mt-4 text-sm text-ink-soft">{t.author_name}{t.author_detail && `, ${t.author_detail}`}</figcaption></figure></Reveal>
            ))}
          </div>
        </div></section>
      )}

      {isOn(c, "journal_visible") && posts.length > 0 && (
        <section className="section" aria-labelledby="jr-h"><div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6"><div id="jr-h"><Heading icon={<Feather size={18} />} eyebrow={c.journal_eyebrow} title={c.journal_heading} /></div><Link href="/journal" className="link-arrow">All articles</Link></div>
          <div className="mt-16 grid gap-x-10 gap-y-16 md:grid-cols-3">{posts.map((p) => <Reveal key={p.id}><PostCard p={p} /></Reveal>)}</div>
        </div></section>
      )}

      <LotusDivider tone="muted" className="pt-4" />

      {isOn(c, "private_visible") && (
        <section className="section" aria-labelledby="private-h"><div className="container-x grid items-end gap-8 md:grid-cols-12 md:gap-16">
          <Reveal className="md:col-span-7"><Eyebrow icon={<Lotus size={20} />}>{c.private_eyebrow}</Eyebrow><h2 id="private-h" className="h-section">{c.private_heading}</h2><p className="lead mt-6">{c.private_body}</p></Reveal>
          <Reveal className="md:col-span-5 md:text-right" delay={0.1}><Link href="/private" className="btn btn-primary">{c.private_cta_label || "Request a private session"}</Link></Reveal>
        </div></section>
      )}

      {isOn(c, "howto_visible") && (
        <section className="section section-bone" aria-labelledby="howto-h"><div className="container-x grid gap-10 md:grid-cols-12 md:gap-16">
          <Reveal className="md:col-span-5"><Eyebrow icon={<CalendarCheck size={19} />}>{c.howto_eyebrow}</Eyebrow><h2 id="howto-h" className="h-section">{c.howto_heading}</h2></Reveal>
          <Reveal className="md:col-span-7" delay={0.1}>
            <p className="lead">{c.howto_body}</p>
            <p className="mt-6 border-t border-line pt-6 text-ink-soft"><strong className="font-medium text-deep">Cancellation. </strong>{settings.booking.policy}</p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3"><Link href="/book" className="link-arrow">Book a class</Link><Link href="/book/lookup" className="link-arrow">Find or cancel a booking</Link></div>
          </Reveal>
        </div></section>
      )}

      {isOn(c, "newsletter_visible") && (
        <section className="section section-bone border-y border-line" aria-labelledby="nl-h"><div className="container-x grid items-center gap-8 md:grid-cols-2 md:gap-16">
          <Reveal><h2 id="nl-h" className="h-section">{c.newsletter_heading}</h2><p className="lead mt-4">{c.newsletter_body}</p></Reveal>
          <Reveal delay={0.1}><NewsletterForm source="home" /></Reveal>
        </div></section>
      )}

      {isOn(c, "contact_visible") && (
        <section className="section surface-dark relative overflow-hidden" aria-labelledby="ct-h"><div aria-hidden className="glow -right-32 -top-32 h-[28rem] w-[28rem] opacity-60" /><div className="container-x relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <Reveal className="max-w-2xl"><h2 id="ct-h" className="h-section">{c.contact_heading}</h2><p className="lead mt-4">{c.contact_body}</p></Reveal>
          <Reveal delay={0.1}><Link href="/contact" className="btn btn-gold">{c.contact_cta_label || "Contact"} <ArrowRight size={16} aria-hidden /></Link></Reveal>
        </div></section>
      )}
    </>
  );
}
