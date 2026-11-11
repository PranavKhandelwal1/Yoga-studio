export type ClassRow = {
  id: string; slug: string; title: string; summary: string | null; description: string | null; style: string | null;
  duration_minutes: number; price_cents: number | null; currency: string; delivery: "in_person" | "online"; location_name: string | null;
  location_address: string | null; map_url: string | null; teacher_name: string | null; teacher_bio: string | null;
  image_url: string | null; image_alt: string | null; default_capacity: number; status: "draft" | "published" | "archived";
  sort_order: number; seo_title: string | null; seo_description: string | null;
};
export type SessionAvailability = {
  session_id: string; class_id: string; starts_at: string; ends_at: string; capacity: number;
  seats_left: number; status: "scheduled" | "cancelled"; location_override: string | null;
};
export type RetreatRow = {
  id: string; slug: string; title: string; summary: string | null; description: string | null; location: string | null;
  start_date: string | null; end_date: string | null; price_cents: number | null; currency: string;
  deposit_cents: number | null; capacity: number | null; places_taken: number; programme: { title: string; description: string }[];
  hero_image_url: string | null; hero_image_alt: string | null; gallery: { url: string; alt: string }[];
  status: "draft" | "published" | "archived"; is_featured: boolean; seo_title: string | null; seo_description: string | null;
};
export type GalleryImage = {
  id: string; url: string; alt: string; caption: string | null; category: string; width: number | null;
  height: number | null; sort_order: number; status: "draft" | "published";
};
export type Testimonial = { id: string; author_name: string; author_detail: string | null; quote: string; sort_order: number; status: "draft" | "published" };
export type BlogCategory = { id: string; slug: string; name: string; description: string | null };
export type BlogPost = {
  id: string; slug: string; title: string; excerpt: string | null; body: string; featured_image_url: string | null;
  featured_image_alt: string | null; category_id: string | null; author_name: string | null;
  status: "draft" | "published"; published_at: string | null; seo_title: string | null; seo_description: string | null;
  blog_categories?: BlogCategory | null;
};
export type Settings = {
  general: { site_name: string; tagline: string; teacher_name: string; default_seo_description?: string };
  contact: { email: string; phone: string; whatsapp: string; location: string; studio_name: string; studio_address: string; map_query: string };
  social: { instagram?: string; facebook?: string; twitter?: string; youtube?: string; tiktok?: string };
  schedule_note: { text: string };
  booking: { cancel_hours: string; policy: string };
};
