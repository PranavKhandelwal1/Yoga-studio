"use server";
import { back, dbError, guard, revalidateSite, str } from "@/lib/admin/util";
import { PAGE_SCHEMAS, SETTINGS_SCHEMA } from "@/lib/content/schema";

const safeUrl = (v: string) => !v || /^https?:\/\//i.test(v) || v.startsWith("/");

export async function saveContent(fd: FormData) {
  const { db } = await guard();
  const slug = str(fd, "slug"); const schema = PAGE_SCHEMAS[slug]; const path = `/admin/content/${slug}`;
  if (!schema) back("/admin/content", "err", "Unknown page.");
  const content: Record<string, string> = {};
  for (const s of schema.sections) for (const f of s.fields) {
    if (f.type === "toggle") { content[f.key] = fd.get(f.key) === "on" ? "true" : "false"; continue; }
    const v = (fd.get(f.key) as string | null)?.toString() ?? "";
    if (v.length > 30000) back(path, "err", `${f.label} is too long.`);
    if (f.type === "image" && !safeUrl(v.trim())) back(path, "err", `${f.label}: image must be an http(s) URL.`);
    content[f.key] = f.type === "image" ? v.trim() : v.trim();
    if (f.type === "image") { const alt = (fd.get(`${f.key}_alt`) as string | null)?.toString().trim(); if (alt !== undefined && alt !== null) content[`${f.key}_alt`] = alt; }
  }
  const og = str(fd, "og_image_url");
  if (!safeUrl(og)) back(path, "err", "Social image must be an http(s) URL.");
  const { error } = await db.from("pages").upsert({
    slug, title: schema.label, content, seo_title: str(fd, "seo_title") || null, seo_description: str(fd, "seo_description") || null, og_image_url: og || null, status: "published",
  }, { onConflict: "slug" });
  if (error) back(path, "err", dbError(error));
  revalidateSite();
  back(path, "ok", "Saved. The public page has been updated.");
}

export async function saveSettings(fd: FormData) {
  const { db } = await guard();
  const group = str(fd, "group"); const schema = SETTINGS_SCHEMA[group];
  if (!schema) back("/admin/settings", "err", "Unknown settings group.");
  const value: Record<string, string> = {};
  for (const f of schema.fields) {
    const v = str(fd, f.key);
    if (group === "social" && v && !/^https?:\/\//i.test(v)) back("/admin/settings", "err", `${f.label} must start with https://`);
    if (f.key === "email" && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) back("/admin/settings", "err", "Email address looks invalid.");
    if (f.key === "whatsapp" && v && !/^\d{6,16}$/.test(v)) back("/admin/settings", "err", "WhatsApp number: digits only, with country code (e.g. 34662410119).");
    value[f.key] = v.slice(0, 2000);
  }
  const { error } = await db.from("site_settings").upsert({ key: group, value }, { onConflict: "key" });
  if (error) back("/admin/settings", "err", dbError(error));
  revalidateSite();
  back("/admin/settings", "ok", `${schema.label} saved.`);
}
