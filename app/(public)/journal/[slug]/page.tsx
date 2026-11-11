import { notFound } from "next/navigation";
import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { PostCard } from "@/components/journal/PostCard";
import { getPost, getRelatedPosts } from "@/lib/data/queries";
import { getSettings } from "@/lib/content/get";
import { readingMinutes, renderMarkdown } from "@/lib/markdown";
import { buildMetadata, jsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/utils/format";
import { fmtDate } from "@/lib/utils/time";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const p = await getPost((await params).slug);
  if (!p) return {};
  return buildMetadata({ title: p.seo_title ?? p.title, description: p.seo_description ?? p.excerpt, path: `/journal/${p.slug}`, image: p.featured_image_url, type: "article" });
}

export default async function PostPage({ params }: Props) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const [related, settings] = await Promise.all([getRelatedPosts(post), getSettings()]);
  const ld = { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt ?? undefined, image: post.featured_image_url ?? undefined,
    datePublished: post.published_at, author: { "@type": "Person", name: post.author_name || settings.general.teacher_name },
    publisher: { "@type": "Organization", name: settings.general.site_name, url: SITE_URL }, mainEntityOfPage: `${SITE_URL}/journal/${post.slug}` };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <article className="section"><div className="container-x">
        <header className="mx-auto max-w-3xl text-center">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-soft"><Link href="/journal" className="hover:underline">Journal</Link>{post.blog_categories && <> / <Link href={`/journal?category=${post.blog_categories.slug}`} className="hover:underline">{post.blog_categories.name}</Link></>}</nav>
          <h1 className="h-display !text-[clamp(2.5rem,6vw,4.75rem)]">{post.title}</h1>
          <p className="mt-6 text-sm text-ink-soft">{post.published_at && <time dateTime={post.published_at}>{fmtDate(post.published_at, { weekday: undefined })}</time>} · {readingMinutes(post.body)} min read{post.author_name && ` · ${post.author_name}`}</p>
        </header>
        {post.featured_image_url && <div className="relative mx-auto mt-12 aspect-[16/9] max-w-5xl overflow-hidden bg-sage/25"><SmartImage src={post.featured_image_url} alt={post.featured_image_alt ?? post.title} fill priority sizes="(min-width:1024px) 64rem, 100vw" className="object-cover" /></div>}
        <div className="prose-yoga mx-auto mt-12 text-[1.125rem]" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
      </div></article>
      {related.length > 0 && (
        <section className="section border-t border-sage/50" aria-labelledby="rel"><div className="container-x"><h2 id="rel" className="h-section">Related articles</h2>
          <div className="mt-10 grid gap-x-8 gap-y-12 md:grid-cols-3">{related.map((p) => <PostCard key={p.id} p={p} />)}</div></div></section>
      )}
    </>
  );
}
