import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { fmtDate } from "@/lib/utils/time";
import type { BlogPost } from "@/types/db";

export function PostCard({ p }: { p: BlogPost }) {
  return (
    <article className="group flex flex-col">
      {p.featured_image_url && (
        <Link href={`/journal/${p.slug}`} className="photo aspect-[3/2]" aria-hidden tabIndex={-1}>
          <SmartImage src={p.featured_image_url} alt={p.featured_image_alt ?? p.title} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
        </Link>
      )}
      <div className={p.featured_image_url ? "mt-6" : "border-t border-deep pt-6"}>
        <p className="text-sm text-ink-soft">{p.blog_categories?.name ?? "Journal"}{p.published_at && <> &nbsp;/&nbsp; {fmtDate(p.published_at, { weekday: undefined, day: "numeric", month: "short", year: "numeric" })}</>}</p>
        <h3 className="h-sub mt-2"><Link href={`/journal/${p.slug}`}>{p.title}</Link></h3>
        {p.excerpt && <p className="mt-3 line-clamp-3 text-ink-soft">{p.excerpt}</p>}
        <Link href={`/journal/${p.slug}`} className="link-arrow mt-5">Read article</Link>
      </div>
    </article>
  );
}
