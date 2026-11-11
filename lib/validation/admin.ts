import { z } from "zod";

const slug = z.string().trim().min(1, "Slug is required").max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");
const url = z.string().trim().max(2000).refine((v) => !v || /^https?:\/\//.test(v) || v.startsWith("/"), "Must be an http(s) URL or start with /");

export const classSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(140),
  slug,
  summary: z.string().trim().max(400).nullable(),
  description: z.string().trim().max(20000).nullable(),
  style: z.string().trim().max(80).nullable(),
  duration_minutes: z.number().int().min(10).max(600),
  delivery: z.enum(["in_person", "online"]),
  price_cents: z.number().int().min(0).max(10_000_000).nullable(),
  location_name: z.string().trim().max(200).nullable(),
  location_address: z.string().trim().max(300).nullable(),
  teacher_name: z.string().trim().max(120).nullable(),
  teacher_bio: z.string().trim().max(2000).nullable(),
  image_url: url.nullable(),
  image_alt: z.string().trim().max(200).nullable(),
  default_capacity: z.number().int().min(1).max(500),
  status: z.enum(["draft", "published", "archived"]),
  sort_order: z.number().int().min(-1000).max(1000),
  seo_title: z.string().trim().max(120).nullable(),
  seo_description: z.string().trim().max(300).nullable(),
});

export const sessionSchema = z.object({
  class_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  duration_minutes: z.number().int().min(10).max(600),
  capacity: z.number().int().min(1).max(500),
});

export const retreatSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(160),
  slug,
  summary: z.string().trim().max(500).nullable(),
  description: z.string().trim().max(30000).nullable(),
  location: z.string().trim().max(200).nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  price_cents: z.number().int().min(0).nullable(),
  deposit_cents: z.number().int().min(0).nullable().optional(),
  capacity: z.number().int().min(0).max(1000).nullable(),
  places_taken: z.number().int().min(0).max(1000),
  programme: z.array(z.object({ title: z.string().max(160), description: z.string().max(4000) })).max(60),
  hero_image_url: url.nullable(),
  hero_image_alt: z.string().trim().max(200).nullable(),
  gallery: z.array(z.object({ url, alt: z.string().max(200) })).max(40),
  status: z.enum(["draft", "published", "archived"]),
  is_featured: z.boolean(),
  seo_title: z.string().trim().max(120).nullable(),
  seo_description: z.string().trim().max(300).nullable(),
}).refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { message: "End date must be on or after the start date", path: ["end_date"] })
  .refine((v) => v.capacity == null || v.places_taken <= v.capacity, { message: "Places taken can't exceed capacity", path: ["places_taken"] });

export const postSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  slug,
  excerpt: z.string().trim().max(500).nullable(),
  body: z.string().max(200000),
  featured_image_url: url.nullable(),
  featured_image_alt: z.string().trim().max(200).nullable(),
  category_id: z.string().uuid().nullable(),
  author_name: z.string().trim().max(120).nullable(),
  status: z.enum(["draft", "published"]),
  seo_title: z.string().trim().max(120).nullable(),
  seo_description: z.string().trim().max(300).nullable(),
});

export const galleryEditSchema = z.object({
  alt: z.string().trim().min(1, "Alt text is required for accessibility").max(250),
  caption: z.string().trim().max(300).nullable(),
  category: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/, "Category: lowercase letters, numbers, hyphens"),
  sort_order: z.number().int().min(-10000).max(10000),
  status: z.enum(["draft", "published"]),
});

export const testimonialSchema = z.object({
  author_name: z.string().trim().min(1, "Name is required").max(120),
  author_detail: z.string().trim().max(160).nullable(),
  quote: z.string().trim().min(5, "Quote is required").max(1500),
  sort_order: z.number().int(),
  status: z.enum(["draft", "published"]),
});

export const batchSchema = z.object({
  class_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date"),
  range: z.enum(["week", "two_weeks", "four_weeks", "month", "until"]),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/, "Choose a time")).min(1, "Choose a class time").max(2),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day"),
  duration_minutes: z.number().int().min(10).max(600),
  capacity: z.number().int().min(1).max(500),
});
