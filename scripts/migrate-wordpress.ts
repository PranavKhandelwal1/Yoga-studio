/**
 * Imports content from the existing WordPress.com site (bewithyoga.live):
 *   • all journal posts (HTML → Markdown, original slugs kept so old URLs redirect cleanly)
 *   • copies every image used by the gallery / posts / classes into Supabase Storage (resized, WebP)
 *     and rewrites the database URLs so the site no longer depends on the old host.
 *
 *   npm run migrate:wordpress -- --dry-run     # preview, writes nothing
 *   npm run migrate:wordpress                  # do it (idempotent: safe to re-run)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and outbound internet access.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { htmlToMarkdown } from "../lib/utils/html-to-md";
import { slugify } from "../lib/utils/format";

const DRY = process.argv.includes("--dry-run");
const SITE = process.env.WP_SITE ?? "bewithyoga.live";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });
const OLD_HOST = /^https?:\/\/(?:i\d\.wp\.com\/)?(?:bewithyoga\.live|bewithyoga\.files\.wordpress\.com)\//;

const cache = new Map<string, string>();
/** Download → resize → WebP → Storage. Deterministic path (hash of source URL) makes re-runs idempotent. */
async function copyImage(src: string, folder: string): Promise<string> {
  const clean = src.replace(/^https?:\/\/i\d\.wp\.com\//, "https://").split("?")[0];
  if (cache.has(clean)) return cache.get(clean)!;
  const path = `${folder}/${createHash("sha1").update(clean).digest("hex").slice(0, 16)}.webp`;
  const pub = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  if (DRY) { console.log("  [dry] would copy", clean, "→", path); cache.set(clean, pub); return pub; }
  const res = await fetch(clean);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${clean}`);
  const out = await sharp(Buffer.from(await res.arrayBuffer()), { limitInputPixels: 80_000_000 }).rotate().resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const { error } = await sb.storage.from("media").upload(path, out, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
  if (error) throw error;
  cache.set(clean, pub);
  return pub;
}

type WpPost = { slug: string; title: string; date: string; content: string; excerpt: string; featured_image?: string; categories?: Record<string, { name: string; slug: string }> };

async function posts() {
  const all: WpPost[] = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${SITE}/posts?number=100&page=${page}&status=publish&fields=slug,title,date,content,excerpt,featured_image,categories`);
    if (!r.ok) throw new Error(`WordPress API ${r.status}`);
    const j = (await r.json()) as { posts: WpPost[] };
    all.push(...j.posts);
    if (j.posts.length < 100) break;
  }
  return all;
}

async function main() {
  console.log(DRY ? "DRY RUN — nothing will be written.\n" : "Importing…\n");
  let imported = 0, imgFail = 0;
  for (const p of await posts()) {
    const slug = slugify(p.slug) || slugify(p.title);
    let body = htmlToMarkdown(p.content);
    for (const m of new Set([...body.matchAll(/!\[[^\]]*\]\((https?:[^)]+)\)/g)].map((x) => x[1]))) {
      if (!OLD_HOST.test(m)) continue;
      try { body = body.split(m).join(await copyImage(m, "blog")); } catch (e) { imgFail++; console.warn("  ! image skipped:", (e as Error).message); }
    }
    let featured: string | null = null;
    if (p.featured_image && OLD_HOST.test(p.featured_image)) { try { featured = await copyImage(p.featured_image, "blog"); } catch { imgFail++; } }
    const cat = Object.values(p.categories ?? {})[0];
    let category_id: string | null = null;
    if (cat && !DRY) {
      const cs = slugify(cat.slug || cat.name);
      await sb.from("blog_categories").upsert({ slug: cs, name: cat.name }, { onConflict: "slug" });
      category_id = (await sb.from("blog_categories").select("id").eq("slug", cs).single()).data?.id ?? null;
    }
    const row = { slug, title: htmlToMarkdown(p.title).replace(/\n/g, " "), excerpt: htmlToMarkdown(p.excerpt).slice(0, 500) || null, body, featured_image_url: featured, category_id, author_name: "Angela", status: "published", published_at: new Date(p.date).toISOString() };
    console.log(`• ${slug} (${row.published_at.slice(0, 10)})`);
    if (!DRY) { const { error } = await sb.from("blog_posts").upsert(row, { onConflict: "slug" }); if (error) throw error; }
    imported++;
  }

  // Move gallery images (and any hot-linked class/retreat/page images) off the old host.
  const { data: gallery } = await sb.from("gallery_images").select("id,url");
  for (const g of gallery ?? []) {
    if (!OLD_HOST.test(g.url)) continue;
    try { const u = await copyImage(g.url, "gallery"); if (!DRY) await sb.from("gallery_images").update({ url: u }).eq("id", g.id); } catch (e) { imgFail++; console.warn("  ! gallery image skipped:", (e as Error).message); }
  }
  const { data: pages } = await sb.from("pages").select("slug,content");
  for (const pg of pages ?? []) {
    const c = { ...(pg.content as Record<string, string>) }; let changed = false;
    for (const [k, v] of Object.entries(c)) if (typeof v === "string" && OLD_HOST.test(v) && /image|portrait|photo/.test(k)) { try { c[k] = await copyImage(v, "homepage"); changed = true; } catch { imgFail++; } }
    if (changed && !DRY) await sb.from("pages").update({ content: c }).eq("slug", pg.slug);
  }
  console.log(`\nDone. ${imported} post(s) ${DRY ? "found" : "imported"}, ${cache.size} image(s) ${DRY ? "planned" : "copied"}, ${imgFail} failed.`);
  console.log("Note: images shown by default on the public pages (hero, about…) are hot-linked until you re-upload or save them in Admin → Content.");
}

main().catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exit(1); });
