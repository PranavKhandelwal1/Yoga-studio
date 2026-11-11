import { PageHeader } from "@/components/ui/PageHeader";
import { PrivateSessionForm } from "@/components/ui/PrivateSessionForm";
import { getPage } from "@/lib/content/get";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;
export async function generateMetadata() {
  const p = await getPage("private");
  return buildMetadata({ title: p.seo_title ?? "Private sessions", description: p.seo_description, path: "/private" });
}

export default async function PrivatePage() {
  const { content: c } = await getPage("private");
  return (
    <>
      <PageHeader eyebrow={c.hero_eyebrow} title={c.hero_title} subtitle={c.hero_subtitle} />
      <section className="section"><div className="container-x grid gap-14 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-5"><div className="prose-yoga" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }} /></div>
        <div className="lg:col-span-7"><h2 className="h-sub mb-6">Request a session</h2><PrivateSessionForm /></div>
      </div></section>
    </>
  );
}
