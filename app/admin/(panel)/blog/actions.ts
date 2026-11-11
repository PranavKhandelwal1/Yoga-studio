"use server";
import { back, dbError, guard, optStr, parse, revalidateSite, str } from "@/lib/admin/util";
import { postSchema } from "@/lib/validation/admin";
import { slugify } from "@/lib/utils/format";
import { madridLocalToUtc } from "@/lib/utils/time";

export async function savePost(fd: FormData) {
  const { db } = await guard();
  const id = str(fd, "id"); const path = id ? `/admin/blog/${id}` : "/admin/blog/new";
  const title = str(fd, "title");
  const v = parse(postSchema, {
    title, slug: str(fd, "slug") || slugify(title), excerpt: optStr(fd, "excerpt"), body: (fd.get("body") as string) ?? "", featured_image_url: optStr(fd, "featured_image_url"),
    featured_image_alt: optStr(fd, "featured_image_alt"), category_id: optStr(fd, "category_id"), author_name: optStr(fd, "author_name"), status: str(fd, "status"),
    seo_title: optStr(fd, "seo_title"), seo_description: optStr(fd, "seo_description"),
  }, path);
  // Publication time is entered in Mallorca local time. Published + future date = scheduled.
  const when = str(fd, "published_at");
  let published_at: string | null = null;
  if (v.status === "published") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) published_at = madridLocalToUtc(when.slice(0, 10), when.slice(11)).toISOString();
    else published_at = new Date().toISOString();
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) published_at = madridLocalToUtc(when.slice(0, 10), when.slice(11)).toISOString();
  const row = { ...v, published_at };
  if (id) {
    const { error } = await db.from("blog_posts").update(row).eq("id", id);
    if (error) back(path, "err", dbError(error));
    revalidateSite(); back(path, "ok", v.status === "published" && new Date(published_at!) > new Date() ? "Saved and scheduled." : "Saved.");
  }
  const { data, error } = await db.from("blog_posts").insert(row).select("id").single();
  if (error) back(path, "err", dbError(error));
  revalidateSite(); back(`/admin/blog/${data!.id}`, "ok", "Article created.");
}

export async function deletePost(fd: FormData) {
  const { db } = await guard();
  const { error } = await db.from("blog_posts").delete().eq("id", str(fd, "id"));
  if (error) back("/admin/blog", "err", dbError(error));
  revalidateSite(); back("/admin/blog", "ok", "Article deleted.");
}

export async function saveCategory(fd: FormData) {
  const { db } = await guard();
  const id = str(fd, "id"); const name = str(fd, "name"); const path = "/admin/blog/categories";
  if (name.length < 2) back(path, "err", "Name is required.");
  const row = { name: name.slice(0, 60), slug: slugify(str(fd, "slug") || name), description: optStr(fd, "description") };
  if (!row.slug) back(path, "err", "Invalid slug.");
  const { error } = id ? await db.from("blog_categories").update(row).eq("id", id) : await db.from("blog_categories").insert(row);
  if (error) back(path, "err", dbError(error));
  revalidateSite(); back(path, "ok", "Category saved.");
}

export async function deleteCategory(fd: FormData) {
  const { db } = await guard();
  const { error } = await db.from("blog_categories").delete().eq("id", str(fd, "id"));
  if (error) back("/admin/blog/categories", "err", dbError(error));
  revalidateSite(); back("/admin/blog/categories", "ok", "Category deleted (its articles are now uncategorised).");
}
