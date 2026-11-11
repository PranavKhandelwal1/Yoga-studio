import { PageHeader } from "@/components/ui/PageHeader";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/ui/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { getPage } from "@/lib/content/get";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;
export async function generateMetadata() {
  const p = await getPage("about");
  return buildMetadata({ title: p.seo_title ?? "About Angela", description: p.seo_description, path: "/about", image: p.og_image_url ?? p.content.portrait });
}

function Block({ title, body }: { title: string; body: string }) {
  if (!body?.trim()) return null;
  return (
    <Reveal><section className="border-t border-forest/40 pt-6">
      <h2 className="h-sub">{title}</h2>
      <div className="prose-yoga mt-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
    </section></Reveal>
  );
}

export default async function AboutPage() {
  const { content: c } = await getPage("about");
  return (
    <>
      <PageHeader eyebrow={c.hero_eyebrow} title={c.hero_title} subtitle={c.hero_subtitle} />
      <section className="section"><div className="container-x grid gap-12 md:grid-cols-12 md:gap-16">
        <Reveal className="md:col-span-5"><div className="relative aspect-[4/5] overflow-hidden bg-sage/25 md:sticky md:top-28"><SmartImage src={c.portrait} alt={c.portrait_alt} fill priority sizes="(min-width:768px) 40vw, 100vw" className="object-cover" /></div></Reveal>
        <div className="space-y-12 md:col-span-7">
          {c.bio_body?.trim() ? <Block title={c.bio_heading} body={c.bio_body} /> : (
            <section className="border-t border-forest/40 pt-6"><h2 className="h-sub">{c.bio_heading}</h2><p className="mt-4 text-ink-soft">{c.bio_empty}</p></section>
          )}
          <Block title={c.philosophy_heading} body={c.philosophy_body} />
          <Block title={c.experience_heading} body={c.experience_body} />
          <Block title={c.approach_heading} body={c.approach_body} />
        </div>
      </div></section>
      {c.photo2 && <section className="container-x pb-16"><Reveal><div className="relative aspect-[16/8] overflow-hidden bg-sage/25"><SmartImage src={c.photo2} alt={c.photo2_alt} fill sizes="100vw" className="object-cover" /></div></Reveal></section>}
      <section className="section bg-forest text-cream"><div className="container-x flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div className="max-w-2xl"><h2 className="h-section !text-cream">{c.cta_heading}</h2><p className="lead mt-4 !text-cream/80">{c.cta_body}</p></div>
        <ButtonLink href="/contact" variant="light">{c.cta_label}</ButtonLink>
      </div></section>
    </>
  );
}
