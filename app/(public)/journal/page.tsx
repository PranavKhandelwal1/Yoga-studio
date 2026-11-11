import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PostCard } from "@/components/journal/PostCard";
import { getCategories, getPosts, PAGE_SIZE } from "@/lib/data/queries";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildMetadata({ title: "Journal", description: "Reflections on yoga, practice and living with an open heart — the Be With Yoga journal by Angela.", path: "/journal" });

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ posts, total }, categories] = await Promise.all([getPosts({ q: sp.q, category: sp.category, page }), getCategories()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (o: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ q: sp.q, category: sp.category, ...o })) if (v) p.set(k, String(v)); const s = p.toString(); return `/journal${s ? `?${s}` : ""}`; };
  return (
    <>
      <PageHeader eyebrow="Journal" title="From the journal" subtitle="Reflections on yoga and practice." />
      <section className="section"><div className="container-x">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Categories" className="flex flex-wrap gap-2">
            <Link href={qs({ category: undefined })} aria-current={!sp.category ? "page" : undefined} className={`min-h-11 border px-4 py-2.5 text-[0.8125rem] ${!sp.category ? "border-deep bg-deep text-cream" : "border-sage hover:bg-sage/30"}`}>All</Link>
            {categories.map((c) => <Link key={c.id} href={qs({ category: c.slug })} aria-current={sp.category === c.slug ? "page" : undefined} className={`min-h-11 border px-4 py-2.5 text-[0.8125rem] ${sp.category === c.slug ? "border-deep bg-deep text-cream" : "border-sage hover:bg-sage/30"}`}>{c.name}</Link>)}
          </nav>
          <form action="/journal" role="search" className="flex w-full gap-2 md:w-80">
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            <label htmlFor="q" className="sr-only">Search articles</label>
            <input id="q" name="q" defaultValue={sp.q} placeholder="Search articles" className="input" maxLength={100} />
            <button className="btn btn-primary !px-4" aria-label="Search"><Search size={18} /></button>
          </form>
        </div>
        {sp.q && <p className="mb-8 text-ink-soft">{total} {total === 1 ? "result" : "results"} for “{sp.q}” · <Link href={qs({ q: undefined })} className="underline underline-offset-4">clear</Link></p>}
        {posts.length === 0 ? <p className="border border-sage/60 bg-white/50 p-8 text-ink-soft">{sp.q || sp.category ? "No articles match your search." : "Articles are coming soon."}</p> : (
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">{posts.map((p) => <PostCard key={p.id} p={p} />)}</div>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="mt-16 flex items-center justify-between">
            {page > 1 ? <Link href={qs({ page: page - 1 })} className="btn btn-outline">Newer</Link> : <span />}
            <span className="text-sm text-ink-soft">Page {page} of {pages}</span>
            {page < pages ? <Link href={qs({ page: page + 1 })} className="btn btn-outline">Older</Link> : <span />}
          </nav>
        )}
      </div></section>
    </>
  );
}
