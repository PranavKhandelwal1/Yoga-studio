import { cache } from "react";
import { publicClient } from "@/lib/supabase/public";
import { DEFAULT_PAGES, DEFAULT_SETTINGS, type Content } from "./defaults";
import type { Settings } from "@/types/db";

export type PageData = { title: string; content: Content; seo_title?: string | null; seo_description?: string | null; og_image_url?: string | null };

/** Returns page content: database values layered over defaults (blank DB values fall back too, except where blank is intentional). */
export const getPage = cache(async (slug: string): Promise<PageData> => {
  const def = DEFAULT_PAGES[slug] ?? { title: slug, content: {} };
  const db = publicClient();
  if (!db) return def;
  try {
    const { data } = await db.from("pages").select("title,content,seo_title,seo_description,og_image_url").eq("slug", slug).maybeSingle();
    if (!data) return def;
    return {
      title: data.title || def.title,
      content: { ...def.content, ...(data.content as Content) },
      seo_title: data.seo_title ?? def.seo_title,
      seo_description: data.seo_description ?? def.seo_description,
      og_image_url: data.og_image_url,
    };
  } catch { return def; }
});

export const getSettings = cache(async (): Promise<Settings> => {
  const db = publicClient();
  if (!db) return DEFAULT_SETTINGS;
  try {
    const { data } = await db.from("site_settings").select("key,value");
    const out = structuredClone(DEFAULT_SETTINGS) as Settings & Record<string, unknown>;
    for (const row of data ?? []) {
      if (row.key in out) (out as Record<string, unknown>)[row.key] = { ...(out as Record<string, unknown>)[row.key] as object, ...(row.value as object) };
    }
    return out;
  } catch { return DEFAULT_SETTINGS; }
});

export const isOn = (c: Content, key: string) => c[key] !== "false";
