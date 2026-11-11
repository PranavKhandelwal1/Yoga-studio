"use server";
import { back, dbError, guard, int, optStr, parse, revalidateSite, str } from "@/lib/admin/util";
import { galleryEditSchema } from "@/lib/validation/admin";
import { DEFAULT_ALT } from "@/lib/content/constants";

/** Called by the uploader after files were stored. Images go live straight away (with a generic description the admin can refine). */
export async function addGalleryImages(items: { url: string; width: number; height: number }[], category = "general") {
  const { db } = await guard();
  const rows = items.filter((i) => /^https:\/\//.test(i.url)).slice(0, 50).map((i) => ({ url: i.url, width: Math.round(i.width) || null, height: Math.round(i.height) || null, alt: DEFAULT_ALT, category: category.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general", status: "published" as const }));
  if (!rows.length) return { error: "Nothing to add." };
  const { error } = await db.from("gallery_images").insert(rows);
  if (error) return { error: dbError(error) };
  revalidateSite();
  return { ok: true };
}

export async function saveGalleryImage(fd: FormData) {
  const { db } = await guard();
  const v = parse(galleryEditSchema, { alt: str(fd, "alt"), caption: optStr(fd, "caption"), category: str(fd, "category").toLowerCase().replace(/\s+/g, "-"), sort_order: int(fd, "sort_order", 0), status: str(fd, "status") }, "/admin/gallery");
  const { error } = await db.from("gallery_images").update(v).eq("id", str(fd, "id"));
  if (error) back("/admin/gallery", "err", dbError(error));
  revalidateSite(); back("/admin/gallery", "ok", "Image saved.");
}

export async function deleteGalleryImage(fd: FormData) {
  const { db } = await guard();
  const id = str(fd, "id");
  const { data } = await db.from("gallery_images").select("url").eq("id", id).maybeSingle();
  const { error } = await db.from("gallery_images").delete().eq("id", id);
  if (error) back("/admin/gallery", "err", dbError(error));
  const m = data?.url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
  if (m) await db.storage.from("media").remove([decodeURIComponent(m[1])]); // best effort; only our own uploads
  revalidateSite(); back("/admin/gallery", "ok", "Image deleted.");
}
