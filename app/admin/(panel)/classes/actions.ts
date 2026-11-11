"use server";
import { back, bool, cents, dbError, guard, int, optStr, parse, revalidateSite, str } from "@/lib/admin/util";
import { batchSchema, classSchema, sessionSchema } from "@/lib/validation/admin";
import { batchDates } from "@/lib/utils/batch";
import { madridLocalToUtc } from "@/lib/utils/time";
import { slugify } from "@/lib/utils/format";
import { sendMail, visitorCancelled } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/payments/stripe";
import { refundBooking } from "@/lib/payments/checkout";
import { formatPrice } from "@/lib/utils/format";

const hasUpcomingSession = async (db: Awaited<ReturnType<typeof guard>>["db"], classId: string) => {
  const { count } = await db.from("class_sessions").select("id", { count: "exact", head: true }).eq("class_id", classId).eq("status", "scheduled").gt("starts_at", new Date().toISOString());
  return (count ?? 0) > 0;
};

async function saveOnlineLink(db: Awaited<ReturnType<typeof guard>>["db"], classId: string, url: string | null) {
  if (url) return db.from("class_private").upsert({ class_id: classId, online_url: url, updated_at: new Date().toISOString() }, { onConflict: "class_id" });
  return db.from("class_private").delete().eq("class_id", classId);
}

export async function saveClass(fd: FormData) {
  const { db } = await guard();
  const id = str(fd, "id");
  const path = id ? `/admin/classes/${id}` : "/admin/classes/new";
  const price = cents(fd, "price");
  if (Number.isNaN(price)) back(path, "err", "Price must be a number (e.g. 15 or 15.50).");
  const title = str(fd, "title");
  const delivery = str(fd, "delivery") === "online" ? "online" : "in_person";
  const onlineUrl = optStr(fd, "online_url");
  if (onlineUrl && !/^https:\/\/\S+$/i.test(onlineUrl)) back(path, "err", "The meeting link must start with https:// (e.g. your Zoom or Google Meet link).");
  const v = parse(classSchema, {
    title, slug: str(fd, "slug") || slugify(title), summary: optStr(fd, "summary"), description: optStr(fd, "description"), style: optStr(fd, "style"),
    duration_minutes: int(fd, "duration_minutes", 90), delivery, price_cents: price, location_name: optStr(fd, "location_name") ?? (delivery === "online" ? "Online" : null), location_address: optStr(fd, "location_address"),
    teacher_name: optStr(fd, "teacher_name"), teacher_bio: optStr(fd, "teacher_bio"), image_url: optStr(fd, "image_url"), image_alt: optStr(fd, "image_alt"),
    default_capacity: int(fd, "default_capacity", 10), status: str(fd, "status"), sort_order: int(fd, "sort_order", 0), seo_title: optStr(fd, "seo_title"), seo_description: optStr(fd, "seo_description"),
  }, path);
  const wantsPublish = v.status === "published";

  if (id) {
    // Rule: no class goes live without a date. Everything else is still saved, as a draft.
    const blocked = wantsPublish && !(await hasUpcomingSession(db, id));
    const { error } = await db.from("classes").update(blocked ? { ...v, status: "draft" as const } : v).eq("id", id);
    if (error) back(path, "err", dbError(error));
    const pe = await saveOnlineLink(db, id, delivery === "online" ? onlineUrl : null);
    if (pe.error) back(path, "err", dbError(pe.error));
    revalidateSite();
    if (blocked) back(path, "err", "Saved as DRAFT — a class can't be published without a date. Add dates in the Schedule section below, then publish.");
    back(path, "ok", "Class saved.");
  }

  // New class: always created as a draft first; then the first date (if given) is added, and only then is it published.
  const { data, error } = await db.from("classes").insert({ ...v, status: "draft" }).select("id").single();
  if (error) back(path, "err", dbError(error));
  const newId = data!.id as string;
  if (delivery === "online" && onlineUrl) await saveOnlineLink(db, newId, onlineUrl);
  const date = str(fd, "first_date"), time = str(fd, "first_time");
  let published = false;
  if (date && time) {
    const sv = parse(sessionSchema, { class_id: newId, date, time, duration_minutes: v.duration_minutes, capacity: v.default_capacity }, `/admin/classes/${newId}`);
    const starts = madridLocalToUtc(sv.date, sv.time);
    if (starts.getTime() > Date.now()) {
      const { error: se } = await db.from("class_sessions").insert({ class_id: newId, starts_at: starts.toISOString(), ends_at: new Date(+starts + v.duration_minutes * 60000).toISOString(), capacity: v.default_capacity });
      if (!se && wantsPublish) { const { error: pe } = await db.from("classes").update({ status: "published" }).eq("id", newId); published = !pe; }
    }
  }
  revalidateSite();
  if (wantsPublish && !published) back(`/admin/classes/${newId}`, "err", "Class created as a DRAFT — choose a date (or use the batch scheduler below) and it can then be published.");
  back(`/admin/classes/${newId}`, "ok", published ? "Class created and published." : "Class created. Add dates below, then publish it.");
}

/** Deletes a class; if bookings reference it, archives instead so history is preserved. */
export async function deleteClass(fd: FormData) {
  const { db } = await guard();
  const id = str(fd, "id");
  const { error } = await db.from("classes").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      await db.from("classes").update({ status: "archived" }).eq("id", id);
      revalidateSite();
      back("/admin/classes", "ok", "This class has bookings, so it was archived instead of deleted.");
    }
    back("/admin/classes", "err", dbError(error));
  }
  revalidateSite();
  back("/admin/classes", "ok", "Class deleted.");
}

export async function addSession(fd: FormData) {
  const { db } = await guard();
  const classId = str(fd, "class_id"); const path = `/admin/classes/${classId}`;
  const v = parse(sessionSchema, { class_id: classId, date: str(fd, "date"), time: str(fd, "time"), duration_minutes: int(fd, "duration_minutes", 90), capacity: int(fd, "capacity", 10) }, path);
  const starts = madridLocalToUtc(v.date, v.time);
  if (starts.getTime() <= Date.now()) back(path, "err", "Choose a date and time in the future.");
  const { error } = await db.from("class_sessions").insert({ class_id: classId, starts_at: starts.toISOString(), ends_at: new Date(+starts + v.duration_minutes * 60000).toISOString(), capacity: v.capacity });
  if (error) back(path, "err", dbError(error));
  revalidateSite();
  back(path, "ok", "Session added.");
}

/**
 * Batch scheduler: the same class at the same time(s) on the chosen weekdays across a whole week, month or custom period
 * (Mallorca wall-clock times, DST-safe). Existing and past sessions are skipped, so it is safe to run twice.
 */
export async function addBatch(fd: FormData) {
  const { db } = await guard();
  const classId = str(fd, "class_id"); const path = `/admin/classes/${classId}`;
  const v = parse(batchSchema, {
    class_id: classId, start_date: str(fd, "start_date"), range: str(fd, "range") || "month", until: str(fd, "until") || undefined,
    times: [str(fd, "time"), str(fd, "time2")].filter(Boolean), weekdays: fd.getAll("weekday").map((x) => Number(x)),
    duration_minutes: int(fd, "duration_minutes", 90), capacity: int(fd, "capacity", 10),
  }, path);
  if (v.range === "until" && !v.until) back(path, "err", "Choose the last date of the batch.");
  const days = batchDates(v.start_date, v.range, v.weekdays, v.until);
  const rows: { class_id: string; starts_at: string; ends_at: string; capacity: number }[] = [];
  for (const key of days) for (const time of v.times) {
    const starts = madridLocalToUtc(key, time);
    if (starts.getTime() <= Date.now()) continue;
    rows.push({ class_id: classId, starts_at: starts.toISOString(), ends_at: new Date(+starts + v.duration_minutes * 60000).toISOString(), capacity: v.capacity });
  }
  if (!rows.length) back(path, "err", "No future dates matched. Check the start date, the days you ticked and the time.");
  if (rows.length > 400) back(path, "err", `That would create ${rows.length} sessions — please choose a shorter period (max 400 at once).`);
  const { data: created, error } = await db.from("class_sessions").upsert(rows, { onConflict: "class_id,starts_at", ignoreDuplicates: true }).select("id");
  if (error) back(path, "err", dbError(error));
  const made = created?.length ?? 0;
  let note = "";
  if (str(fd, "publish") === "on" && made + (rows.length - made) > 0) {
    const { error: pe } = await db.from("classes").update({ status: "published" }).eq("id", classId);
    note = pe ? ` (Could not publish: ${dbError(pe)})` : " The class is now published.";
  }
  revalidateSite();
  back(path, "ok", `${made} session${made === 1 ? "" : "s"} created${rows.length - made > 0 ? `, ${rows.length - made} already existed` : ""}.${note}`);
}

export async function updateSessionCapacity(fd: FormData) {
  const { db } = await guard();
  const classId = str(fd, "class_id"); const path = `/admin/classes/${classId}`;
  const cap = int(fd, "capacity", 0);
  if (cap < 1 || cap > 500) back(path, "err", "Capacity must be between 1 and 500.");
  const { error } = await db.from("class_sessions").update({ capacity: cap }).eq("id", str(fd, "session_id"));
  if (error) back(path, "err", dbError(error));
  revalidateSite();
  back(path, "ok", "Capacity updated.");
}

/** Cancels one session. The database cancels its live bookings; we email those visitors. */
export async function cancelSession(fd: FormData) {
  const { db } = await guard();
  const classId = str(fd, "class_id"); const path = `/admin/classes/${classId}`;
  const sid = str(fd, "session_id"); const reason = optStr(fd, "reason");
  const { data: live } = await db.from("bookings").select("id,payment_status,total_price_cents,currency,reference,full_name,email,participants,message,class_sessions(starts_at,location_override,classes(title,location_name))").eq("session_id", sid).in("status", ["pending", "approved"]);
  const { error } = await db.from("class_sessions").update({ status: "cancelled", cancel_reason: reason }).eq("id", sid);
  if (error) back(path, "err", dbError(error));
  let mailed = 0, refundedCount = 0; const refundFailures: string[] = [];
  for (const b of (live ?? []) as unknown as { id: string; payment_status: string; total_price_cents: number | null; currency: string; reference: string; full_name: string; email: string; participants: number; message: string | null; class_sessions: { starts_at: string; location_override: string | null; classes: { title: string; location_name: string | null } } }[]) {
    let refunded: string | undefined;
    if (b.payment_status === "paid") { // a cancelled session always refunds paid bookings
      try { if (await refundBooking(createAdminClient(), getStripe(), b.id)) { refunded = formatPrice(b.total_price_cents, b.currency); refundedCount++; } } catch (e) { console.error("[refund]", e); refundFailures.push(b.reference); }
    }
    const ok = await sendMail(visitorCancelled({ refunded, reference: b.reference, fullName: b.full_name, email: b.email, participants: b.participants, className: b.class_sessions.classes.title,
      startsAt: b.class_sessions.starts_at, location: b.class_sessions.location_override ?? b.class_sessions.classes.location_name, message: b.message, note: reason }));
    if (ok) mailed++;
  }
  revalidateSite();
  back(path, refundFailures.length ? "err" : "ok", `Session cancelled. ${live?.length ?? 0} booking(s) cancelled, ${refundedCount} refunded, ${mailed} visitor(s) emailed.${refundFailures.length ? ` REFUND FAILED for ${refundFailures.join(", ")} — please refund those payments in Stripe.` : ""}`);
}

export async function deleteSession(fd: FormData) {
  const { db } = await guard();
  const classId = str(fd, "class_id"); const path = `/admin/classes/${classId}`;
  const { error } = await db.from("class_sessions").delete().eq("id", str(fd, "session_id"));
  if (error) back(path, "err", dbError(error));
  revalidateSite();
  back(path, "ok", "Session deleted.");
}
