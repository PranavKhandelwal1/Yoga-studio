import { PageHeader } from "@/components/ui/PageHeader";
import { RetreatCard } from "@/components/retreats/RetreatCard";
import { NewsletterForm } from "@/components/ui/NewsletterForm";
import { ButtonLink } from "@/components/ui/Button";
import { getRetreats } from "@/lib/data/queries";
import { getPage } from "@/lib/content/get";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildMetadata({ title: "Yoga retreats in Mallorca", description: "Yoga retreats in Mallorca with Angela. Programme, dates, prices and availability.", path: "/retreats" });

export default async function RetreatsPage() {
  const [retreats, home] = await Promise.all([getRetreats(), getPage("home")]);
  return (
    <>
      <PageHeader eyebrow="Retreats" title="Yoga retreats in Mallorca" subtitle={home.content.retreats_body} />
      <section className="section"><div className="container-x">
        {retreats.length === 0 ? (
          <div className="grid items-center gap-10 border border-sage/60 bg-white/50 p-8 md:grid-cols-2 md:p-12">
            <div><p className="font-serif text-3xl leading-snug text-deep md:text-4xl">{home.content.retreats_empty}</p><div className="mt-6"><ButtonLink href="/contact" variant="outline">Ask about retreats</ButtonLink></div></div>
            <NewsletterForm source="retreats" />
          </div>
        ) : <div className="space-y-20">{retreats.map((r) => <RetreatCard key={r.id} r={r} />)}</div>}
      </div></section>
    </>
  );
}
