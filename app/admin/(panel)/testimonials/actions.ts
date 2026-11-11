"use server";
import { back, dbError, guard, int, optStr, parse, revalidateSite, str } from "@/lib/admin/util";
import { testimonialSchema } from "@/lib/validation/admin";

export async function saveTestimonial(fd: FormData) {
  const { db } = await guard();
  const id = str(fd, "id"); const path = "/admin/testimonials";
  const v = parse(testimonialSchema, { author_name: str(fd, "author_name"), author_detail: optStr(fd, "author_detail"), quote: str(fd, "quote"), sort_order: int(fd, "sort_order", 0), status: str(fd, "status") }, path);
  const { error } = id ? await db.from("testimonials").update(v).eq("id", id) : await db.from("testimonials").insert(v);
  if (error) back(path, "err", dbError(error));
  revalidateSite(); back(path, "ok", id ? "Testimonial saved." : "Testimonial added.");
}
export async function deleteTestimonial(fd: FormData) {
  const { db } = await guard();
  const { error } = await db.from("testimonials").delete().eq("id", str(fd, "id"));
  if (error) back("/admin/testimonials", "err", dbError(error));
  revalidateSite(); back("/admin/testimonials", "ok", "Testimonial deleted.");
}
