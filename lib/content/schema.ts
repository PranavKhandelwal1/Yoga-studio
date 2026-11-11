/** Describes every editable field in the CMS. The admin editor and the public pages share these keys. */
export type FieldType = "text" | "textarea" | "image" | "toggle" | "markdown";
export type Field = { key: string; label: string; type: FieldType; help?: string };
export type Section = { id: string; label: string; fields: Field[] };

const sec = (id: string, label: string, fields: Field[]): Section => ({ id, label, fields });
const t = (key: string, label: string, type: FieldType = "text", help?: string): Field => ({ key, label, type, help });

export const PAGE_SCHEMAS: Record<string, { label: string; path: string; sections: Section[] }> = {
  home: {
    label: "Homepage", path: "/",
    sections: [
      sec("hero", "Hero", [t("hero_visible", "Show section", "toggle"), t("hero_eyebrow", "Small heading"), t("hero_title", "Headline"), t("hero_subtitle", "Subtitle"),
        t("hero_cta_label", "Primary button label"), t("hero_cta_href", "Primary button link"), t("hero_cta2_label", "Second button label"), t("hero_cta2_href", "Second button link"), t("hero_image", "Hero image", "image")]),
      sec("intro", "Introduction", [t("intro_visible", "Show section", "toggle"), t("intro_heading", "Heading"), t("intro_body", "Text", "textarea")]),
      sec("classes", "Classes", [t("classes_visible", "Show section", "toggle"), t("classes_eyebrow", "Small heading"), t("classes_heading", "Heading"), t("classes_body", "Text", "textarea")]),
      sec("retreats", "Retreats", [t("retreats_visible", "Show section", "toggle"), t("retreats_eyebrow", "Small heading"), t("retreats_heading", "Heading"), t("retreats_body", "Text", "textarea"), t("retreats_empty", "Text when no retreats are published", "textarea")]),
      sec("about", "About Angela", [t("about_visible", "Show section", "toggle"), t("about_eyebrow", "Small heading"), t("about_heading", "Heading"), t("about_body", "Text", "textarea", "Leave empty to hide the text."), t("about_image", "Photo", "image"), t("about_cta_label", "Button label")]),
      sec("philosophy", "Philosophy & benefits", [t("philosophy_visible", "Show section", "toggle"), t("philosophy_eyebrow", "Small heading"), t("philosophy_heading", "Heading"), t("philosophy_body", "Text", "textarea"),
        t("benefit1_title", "Benefit 1 title"), t("benefit1_text", "Benefit 1 text", "textarea"), t("benefit2_title", "Benefit 2 title"), t("benefit2_text", "Benefit 2 text", "textarea"), t("benefit3_title", "Benefit 3 title"), t("benefit3_text", "Benefit 3 text", "textarea")]),
      sec("gallery", "Gallery strip", [t("gallery_visible", "Show section", "toggle"), t("gallery_eyebrow", "Small heading"), t("gallery_heading", "Heading")]),
      sec("journal", "Journal", [t("journal_visible", "Show section", "toggle"), t("journal_eyebrow", "Small heading"), t("journal_heading", "Heading")]),
      sec("testimonials", "Testimonials", [t("testimonials_visible", "Show section", "toggle", "Only shown when you have published testimonials."), t("testimonials_heading", "Heading")]),
      sec("private", "Private sessions", [t("private_visible", "Show section", "toggle"), t("private_eyebrow", "Small heading"), t("private_heading", "Heading"), t("private_body", "Text", "textarea"), t("private_cta_label", "Button text")]),
      sec("howto", "Booking & cancellation", [t("howto_visible", "Show section", "toggle"), t("howto_eyebrow", "Small heading"), t("howto_heading", "Heading"), t("howto_body", "How booking works", "textarea", "The cancellation policy itself is edited in Settings → Booking & cancellation and is shown below this text.")]),
      sec("newsletter", "Newsletter", [t("newsletter_visible", "Show section", "toggle"), t("newsletter_heading", "Heading"), t("newsletter_body", "Text", "textarea")]),
      sec("contact", "Contact call-to-action", [t("contact_visible", "Show section", "toggle"), t("contact_heading", "Heading"), t("contact_body", "Text", "textarea"), t("contact_cta_label", "Button label")]),
    ],
  },
  about: {
    label: "About page", path: "/about",
    sections: [
      sec("hero", "Header", [t("hero_eyebrow", "Small heading"), t("hero_title", "Title"), t("hero_subtitle", "Subtitle")]),
      sec("bio", "Biography", [t("portrait", "Portrait", "image"), t("bio_heading", "Heading"), t("bio_body", "Biography", "markdown", "Markdown supported."), t("bio_empty", "Text shown while the biography is empty")]),
      sec("philosophy", "Teaching philosophy", [t("philosophy_heading", "Heading"), t("philosophy_body", "Text", "markdown")]),
      sec("experience", "Experience & qualifications", [t("experience_heading", "Heading"), t("experience_body", "Text", "markdown")]),
      sec("approach", "Personal approach", [t("approach_heading", "Heading"), t("approach_body", "Text", "markdown"), t("photo2", "Second photograph", "image")]),
      sec("cta", "Call-to-action", [t("cta_heading", "Heading"), t("cta_body", "Text", "textarea"), t("cta_label", "Button label")]),
    ],
  },
  private: {
    label: "Private sessions", path: "/private",
    sections: [
      sec("hero", "Header", [t("hero_eyebrow", "Small heading"), t("hero_title", "Title"), t("hero_subtitle", "Subtitle", "textarea")]),
      sec("body", "Page text", [t("body", "About private sessions", "markdown", "Describe what a private session is, who it suits and how it works. Mention prices here only if you want them public.")]),
    ],
  },
  privacy: {
    label: "Privacy policy", path: "/privacy",
    sections: [sec("body", "Policy text", [t("body", "Policy", "markdown", "Markdown supported. Please have this reviewed before launch.")])],
  },
};

export const SETTINGS_SCHEMA: Record<string, { label: string; fields: Field[] }> = {
  general: { label: "General", fields: [t("site_name", "Site name"), t("tagline", "Tagline"), t("teacher_name", "Teacher name"), t("default_seo_description", "Default meta description", "textarea")] },
  contact: { label: "Contact details", fields: [t("email", "Email"), t("phone", "Phone"), t("whatsapp", "WhatsApp number (digits only, with country code)"), t("location", "Location (short)"), t("studio_name", "Studio name"), t("studio_address", "Studio address"), t("map_query", "Google Maps search text")] },
  social: { label: "Social media", fields: [t("instagram", "Instagram URL"), t("facebook", "Facebook URL"), t("twitter", "X / Twitter URL"), t("youtube", "YouTube URL"), t("tiktok", "TikTok URL")] },
  booking: { label: "Booking & cancellation", fields: [t("cancel_hours", "Free cancellation until (hours before class)", "text", "Guests can cancel online and get a full automatic refund until this many hours before the class starts. 0 = until it starts."), t("policy", "Cancellation policy text", "textarea", "Shown on the booking page, class pages and in emails.")] },
  schedule_note: { label: "Schedule note", fields: [t("text", "Text shown on the schedule page", "textarea")] },
};
