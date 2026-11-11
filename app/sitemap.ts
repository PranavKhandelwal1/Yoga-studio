import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/data/queries";
import { SITE_URL } from "@/lib/utils/format";

export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { classes, retreats, posts } = await getAllSlugs();
  const now = new Date();
  const fixed = ["", "/about", "/classes", "/schedule", "/retreats", "/gallery", "/journal", "/contact", "/book", "/book/lookup", "/private", "/privacy"];
  return [
    ...fixed.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...classes.map((s) => ({ url: `${SITE_URL}/classes/${s}`, lastModified: now, priority: 0.6 })),
    ...retreats.map((s) => ({ url: `${SITE_URL}/retreats/${s}`, lastModified: now, priority: 0.6 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/journal/${p.slug}`, lastModified: p.updated ? new Date(p.updated) : now, priority: 0.5 })),
  ];
}
