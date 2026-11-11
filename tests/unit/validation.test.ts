import { describe, expect, it } from "vitest";
import { bookingSchema, contactSchema } from "@/lib/validation/schemas";
import { classSchema, postSchema, retreatSchema } from "@/lib/validation/admin";
import { canTransition, mapBookingError } from "@/lib/booking/service";

const valid = { sessionId: "6f1b3a0e-5d0b-4a43-9d0e-0f2f1b9a1c11", fullName: "  Ana  García ", email: "ANA@Example.com ", phone: "+34 600 111 222", participants: "2", message: "Hi", privacyConsent: true };

describe("bookingSchema", () => {
  it("accepts and normalises a valid request", () => {
    const r = bookingSchema.parse(valid);
    expect(r.email).toBe("ana@example.com"); expect(r.participants).toBe(2); expect(r.fullName).toBe("Ana  García");
  });
  it("requires privacy consent", () => expect(bookingSchema.safeParse({ ...valid, privacyConsent: false }).success).toBe(false));
  it("rejects bad email, bad phone, bad participants and non-UUID session", () => {
    for (const bad of [{ email: "nope" }, { phone: "<script>" }, { participants: 0 }, { participants: 99 }, { sessionId: "1; drop table bookings" }])
      expect(bookingSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
  });
  it("rejects a filled honeypot", () => expect(bookingSchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false));
  it("ignores client-supplied price / status / capacity (strips unknown keys)", () => {
    const r = bookingSchema.parse({ ...valid, price: 0, status: "approved", capacity: 999 }) as Record<string, unknown>;
    expect(r.price).toBeUndefined(); expect(r.status).toBeUndefined(); expect(r.capacity).toBeUndefined();
  });
  it("strips control characters", () => expect(bookingSchema.parse({ ...valid, message: "a\u0000b\u0007c" }).message).toBe("abc"));
});

describe("contactSchema", () => {
  it("rejects too-short messages", () => expect(contactSchema.safeParse({ name: "Al", email: "a@b.co", message: "x", privacyConsent: true }).success).toBe(false));
});

describe("admin schemas", () => {
  const base = { title: "Vinyasa", slug: "vinyasa", summary: null, description: null, style: null, duration_minutes: 90, delivery: "in_person", price_cents: 1500, location_name: null, location_address: null, teacher_name: null, teacher_bio: null, image_url: null, image_alt: null, default_capacity: 10, status: "published", sort_order: 0, seo_title: null, seo_description: null };
  it("accepts a valid class", () => expect(classSchema.safeParse(base).success).toBe(true));
  it("only allows in_person or online delivery", () => { expect(classSchema.safeParse({ ...base, delivery: "online" }).success).toBe(true); expect(classSchema.safeParse({ ...base, delivery: "telepathy" }).success).toBe(false); });
  it("rejects negative price, bad slug, javascript: image URL", () => {
    expect(classSchema.safeParse({ ...base, price_cents: -1 }).success).toBe(false);
    expect(classSchema.safeParse({ ...base, slug: "Bad Slug!" }).success).toBe(false);
    expect(classSchema.safeParse({ ...base, image_url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("retreat: end before start and places_taken > capacity are rejected", () => {
    const r = { title: "Retreat", slug: "r", summary: null, description: null, location: null, start_date: "2027-05-10", end_date: "2027-05-05", price_cents: null, capacity: 8, places_taken: 0, programme: [], hero_image_url: null, hero_image_alt: null, gallery: [], status: "draft", is_featured: false, seo_title: null, seo_description: null };
    expect(retreatSchema.safeParse(r).success).toBe(false);
    expect(retreatSchema.safeParse({ ...r, end_date: "2027-05-12", places_taken: 9 }).success).toBe(false);
    expect(retreatSchema.safeParse({ ...r, end_date: "2027-05-12" }).success).toBe(true);
  });
  it("post: only draft/published", () => expect(postSchema.safeParse({ title: "Hi there", slug: "hi", excerpt: null, body: "", featured_image_url: null, featured_image_alt: null, category_id: null, author_name: null, status: "scheduled", seo_title: null, seo_description: null }).success).toBe(false));
});

describe("booking state machine", () => {
  it("allows only legal transitions", () => {
    expect(canTransition("pending", "approved")).toBe(true); expect(canTransition("pending", "rejected")).toBe(true);
    expect(canTransition("approved", "cancelled")).toBe(true);
    expect(canTransition("approved", "rejected")).toBe(false); expect(canTransition("rejected", "approved")).toBe(false); expect(canTransition("cancelled", "pending")).toBe(false);
  });
  it("maps database errors to codes", () => {
    expect(mapBookingError("SESSION_FULL")).toBe("SESSION_FULL"); expect(mapBookingError("boom")).toBe("UNKNOWN");
  });
});
