import { publicClient } from "@/lib/supabase/public";
import type { BlogCategory, BlogPost, ClassRow, GalleryImage, RetreatRow, SessionAvailability, Testimonial } from "@/types/db";

/** All public reads. Each returns an empty result (never throws) if the database is unreachable. */
async function safe<T>(fallback: T, fn: (db: NonNullable<ReturnType<typeof publicClient>>) => PromiseLike<T>): Promise<T> {
  const db = publicClient();
  if (!db) return fallback;
  try { return await fn(db); } catch { return fallback; }
}

export const getClasses = () => safe<ClassRow[]>([], async (db) =>
  ((await db.from("classes").select("*").eq("status", "published").order("sort_order").order("title")).data ?? []) as ClassRow[]);

export const getClass = (slug: string) => safe<ClassRow | null>(null, async (db) =>
  ((await db.from("classes").select("*").eq("slug", slug).eq("status", "published").maybeSingle()).data ?? null) as ClassRow | null);

/** Seat availability for published classes' sessions in a window (counts only — no personal data). */
export const getAvailability = (from: Date, to: Date) => safe<SessionAvailability[]>([], async (db) => {
  const { data } = await db.rpc("session_availability", { p_from: from.toISOString(), p_to: to.toISOString() });
  return (data ?? []) as SessionAvailability[];
});

export const getRetreats = (opts: { featured?: boolean; limit?: number } = {}) => safe<RetreatRow[]>([], async (db) => {
  let q = db.from("retreats").select("*").eq("status", "published").order("start_date", { ascending: true, nullsFirst: false });
  if (opts.featured) q = q.eq("is_featured", true);
  if (opts.limit) q = q.limit(opts.limit);
  return ((await q).data ?? []) as RetreatRow[];
});

export const getRetreat = (slug: string) => safe<RetreatRow | null>(null, async (db) =>
  ((await db.from("retreats").select("*").eq("slug", slug).eq("status", "published").maybeSingle()).data ?? null) as RetreatRow | null);

export const getGallery = (limit?: number) => safe<GalleryImage[]>([], async (db) => {
  let q = db.from("gallery_images").select("*").eq("status", "published").order("sort_order").order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  return ((await q).data ?? []) as GalleryImage[];
});

export const getTestimonials = () => safe<Testimonial[]>([], async (db) =>
  ((await db.from("testimonials").select("*").eq("status", "published").order("sort_order")).data ?? []) as Testimonial[]);

export const getCategories = () => safe<BlogCategory[]>([], async (db) =>
  ((await db.from("blog_categories").select("*").order("name")).data ?? []) as BlogCategory[]);

const POST_COLS = "id,slug,title,excerpt,featured_image_url,featured_image_alt,category_id,author_name,status,published_at,seo_title,seo_description,blog_categories(id,slug,name,description)";
export const PAGE_SIZE = 9;

export const getPosts = (opts: { limit?: number; page?: number; q?: string; category?: string } = {}) =>
  safe<{ posts: BlogPost[]; total: number }>({ posts: [], total: 0 }, async (db) => {
    const size = opts.limit ?? PAGE_SIZE, page = Math.max(1, opts.page ?? 1);
    let q = db.from("blog_posts").select(POST_COLS + ",body", { count: "exact" })
      .eq("status", "published").lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false }).range((page - 1) * size, page * size - 1);
    if (opts.category) {
      const { data: cat } = await db.from("blog_categories").select("id").eq("slug", opts.category).maybeSingle();
      if (!cat) return { posts: [], total: 0 };
      q = q.eq("category_id", cat.id);
    }
    if (opts.q?.trim()) q = q.textSearch("search", opts.q.trim().slice(0, 100), { type: "websearch", config: "english" });
    const { data, count } = await q;
    return { posts: (data ?? []) as unknown as BlogPost[], total: count ?? 0 };
  });

export const getPost = (slug: string) => safe<BlogPost | null>(null, async (db) =>
  ((await db.from("blog_posts").select(POST_COLS + ",body").eq("slug", slug).eq("status", "published").lte("published_at", new Date().toISOString()).maybeSingle()).data ?? null) as unknown as BlogPost | null);

export const getRelatedPosts = (post: BlogPost, limit = 3) => safe<BlogPost[]>([], async (db) => {
  let q = db.from("blog_posts").select(POST_COLS).eq("status", "published").lte("published_at", new Date().toISOString())
    .neq("id", post.id).order("published_at", { ascending: false }).limit(limit);
  if (post.category_id) q = q.eq("category_id", post.category_id);
  return ((await q).data ?? []) as unknown as BlogPost[];
});

export const getAllSlugs = () => safe<{ classes: string[]; retreats: string[]; posts: { slug: string; updated: string | null }[] }>(
  { classes: [], retreats: [], posts: [] }, async (db) => {
    const [c, r, p] = await Promise.all([
      db.from("classes").select("slug").eq("status", "published"),
      db.from("retreats").select("slug").eq("status", "published"),
      db.from("blog_posts").select("slug,published_at").eq("status", "published").lte("published_at", new Date().toISOString()),
    ]);
    return { classes: (c.data ?? []).map((x) => x.slug), retreats: (r.data ?? []).map((x) => x.slug), posts: (p.data ?? []).map((x) => ({ slug: x.slug, updated: x.published_at })) };
  });
