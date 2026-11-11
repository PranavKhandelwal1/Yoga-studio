import { PageHeader } from "@/components/ui/PageHeader";
import { getPage } from "@/lib/content/get";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildMetadata({ title: "Privacy policy", path: "/privacy", description: "How Be With Yoga collects and uses your personal data." });

export default async function PrivacyPage() {
  const { content } = await getPage("privacy");
  return (
    <>
      <PageHeader title="Privacy policy" />
      <section className="section"><div className="container-x"><div className="prose-yoga" dangerouslySetInnerHTML={{ __html: renderMarkdown(content.body) }} /></div></section>
    </>
  );
}
