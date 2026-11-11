"use server";
import { back, bool, cents, dbError, guard, int, optStr, parse, revalidateSite, str } from "@/lib/admin/util";
import { retreatSchema } from "@/lib/validation/admin";
import { slugify } from "@/lib/utils/format";
import { getStripe } from "@/lib/payments/stripe";
import { refundRetreatDeposit } from "@/lib/payments/retreat";

const json = (fd: FormData, k: string) => { try { const v = JSON.parse(str(fd, k) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const optInt = (fd: FormData, k: string) => (str(fd, k) === "" ? null : int(fd, k, 0));

export async function saveRetreat(fd: FormData) {
  const { db } = await guard();
  const id = str(fd, "id");
  const path = id ? `/admin/retreats/${id}` : "/admin/retreats/new";
  const price = cents(fd, "price");
  if (Number.isNaN(price)) back(path, "err", "Price must be a number.");
  const deposit = cents(fd, "deposit");
  if (Number.isNaN(deposit)) back(path, "err", "Deposit must be a number.");
  if (deposit != null && price != null && deposit > price) back(path, "err", "The deposit can't be more than the full price.");
  const title = str(fd, "title");
  const v = parse(retreatSchema, {
    title, slug: str(fd, "slug") || slugify(title), summary: optStr(fd, "summary"), description: optStr(fd, "description"), location: optStr(fd, "location"),
    start_date: optStr(fd, "start_date"), end_date: optStr(fd, "end_date"), price_cents: price, deposit_cents: deposit && deposit > 0 ? deposit : null, capacity: optInt(fd, "capacity"), places_taken: int(fd, "places_taken", 0),
    programme: json(fd, "programme"), hero_image_url: optStr(fd, "hero_image_url"), hero_image_alt: optStr(fd, "hero_image_alt"), gallery: json(fd, "gallery"),
    status: str(fd, "status"), is_featured: bool(fd, "is_featured"), seo_title: optStr(fd, "seo_title"), seo_description: optStr(fd, "seo_description"),
  }, path);
  if (id) {
    const { error } = await db.from("retreats").update(v).eq("id", id);
    if (error) back(path, "err", dbError(error));
    revalidateSite(); back(path, "ok", "Retreat saved.");
  }
  const { data, error } = await db.from("retreats").insert(v).select("id").single();
  if (error) back(path, "err", dbError(error));
  revalidateSite(); back(`/admin/retreats/${data!.id}`, "ok", "Retreat created.");
}

export async function deleteRetreat(fd: FormData) {
  const { db } = await guard();
  const { error } = await db.from("retreats").delete().eq("id", str(fd, "id"));
  if (error) back("/admin/retreats", "err", dbError(error));
  revalidateSite(); back("/admin/retreats", "ok", "Retreat deleted (its enquiries were removed too).");
}

export async function updateEnquiry(fd: FormData) {
  const { db } = await guard();
  const rid = str(fd, "retreat_id"); const path = `/admin/retreats/${rid}`;
  const status = str(fd, "status");
  if (!["new", "contacted", "confirmed", "closed"].includes(status)) back(path, "err", "Invalid status.");
  const { error } = await db.from("retreat_enquiries").update({ status, admin_notes: optStr(fd, "admin_notes") }).eq("id", str(fd, "id"));
  if (error) back(path, "err", dbError(error));
  back(path, "ok", "Enquiry updated.");
}

export async function deleteEnquiry(fd: FormData) {
  const { db } = await guard();
  const path = `/admin/retreats/${str(fd, "retreat_id")}`;
  const { error } = await db.from("retreat_enquiries").delete().eq("id", str(fd, "id"));
  if (error) back(path, "err", dbError(error));
  back(path, "ok", "Enquiry deleted.");
}

export async function refundDeposit(fd: FormData) {
  const { db } = await guard();
  const path = `/admin/retreats/${str(fd, "retreat_id")}`;
  try {
    const ok = await refundRetreatDeposit(db, getStripe(), str(fd, "id"));
    revalidateSite();
    back(path, ok ? "ok" : "err", ok ? "Deposit refunded and places released." : "Nothing to refund for this enquiry.");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // Next redirect
    back(path, "err", `Refund failed: ${e instanceof Error ? e.message : "unknown error"}. Refund it from your Stripe/PayPal dashboard instead.`);
  }
}
