"use server";
import { z } from "zod";
import { back, bool, dbError, guard, optStr, parse, revalidateSite, str } from "@/lib/admin/util";
import { bookingDecisionSchema } from "@/lib/validation/schemas";
import { DECISION_STATUS } from "@/lib/booking/service";
import { sendMail, visitorApproved, visitorCancelled, visitorRejected, type BookingMailData } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/payments/stripe";
import { payMethods } from "@/lib/payments/methods";
import { refundBooking } from "@/lib/payments/checkout";
import { onlineUrlOf } from "@/lib/utils/online";
import { formatPrice } from "@/lib/utils/format";

type Joined = {
  id: string; reference: string; full_name: string; email: string; participants: number; message: string | null; status: string;
  class_sessions: { starts_at: string; location_override: string | null; classes: { title: string; location_name: string | null; delivery?: string; class_private?: { online_url: string | null } | { online_url: string | null }[] | null } | null } | null;
};

export async function toMail(b: Joined, note?: string | null): Promise<BookingMailData> {
  return { reference: b.reference, fullName: b.full_name, email: b.email, participants: b.participants, className: b.class_sessions?.classes?.title ?? "your class",
    startsAt: b.class_sessions?.starts_at ?? new Date().toISOString(), location: b.class_sessions?.location_override ?? b.class_sessions?.classes?.location_name, message: b.message, note, onlineUrl: onlineUrlOf(b.class_sessions?.classes) };
}

export async function decideBooking(fd: FormData) {
  const { db } = await guard();
  const returnTo = str(fd, "returnTo").startsWith("/admin/") ? str(fd, "returnTo") : "/admin/bookings";
  const input = parse(bookingDecisionSchema, { bookingId: str(fd, "bookingId"), action: str(fd, "action"), note: str(fd, "note") || undefined }, returnTo);
  const { data: before } = await db.from("bookings").select("id,status,payment_status,total_price_cents,currency").eq("id", input.bookingId).maybeSingle();
  if (!before) back(returnTo, "err", "Booking not found.");
  // Pay-first: a priced booking can't be approved by hand while it is still waiting for the visitor's payment.
  if (input.action === "approve" && before.payment_status === "unpaid" && (before.total_price_cents ?? 0) > 0 && payMethods().length > 0)
    back(returnTo, "err", "This booking is awaiting payment. It is confirmed automatically as soon as the visitor pays (or released if they don't).");

  const next = DECISION_STATUS[input.action];
  const upd: Record<string, unknown> = { status: next };
  if (input.note) {
    const { data: cur } = await db.from("bookings").select("admin_notes").eq("id", input.bookingId).single();
    upd.admin_notes = [cur?.admin_notes, `[${next}] ${input.note}`].filter(Boolean).join("\n");
  }
  // The database enforces the legal state machine; we surface its error if the move isn't allowed.
  const { error } = await db.from("bookings").update(upd).eq("id", input.bookingId).eq("status", before.status);
  if (error) back(returnTo, "err", dbError(error));

  // Cancelling a PAID booking refunds it in full (unless the admin unticked the box).
  let refunded: string | undefined; let refundFailed = false;
  if (next === "cancelled" && before.payment_status === "paid" && bool(fd, "refund")) {
    try { if (await refundBooking(createAdminClient(), getStripe(), input.bookingId)) refunded = formatPrice(before.total_price_cents, before.currency); }
    catch (e) { console.error("[refund]", e); refundFailed = true; }
  }

  const { data: full } = await db.from("bookings").select("id,reference,full_name,email,participants,message,status,class_sessions(starts_at,location_override,classes(title,location_name,delivery,class_private(online_url)))").eq("id", input.bookingId).single();
  let mailed = false;
  if (full && bool(fd, "notify") !== false) {
    const mail = { ...(await toMail(full as unknown as Joined, input.note)), refunded };
    mailed = await sendMail(input.action === "approve" ? visitorApproved(mail) : input.action === "reject" ? visitorRejected(mail) : visitorCancelled(mail));
  }
  revalidateSite();
  back(returnTo, refundFailed ? "err" : "ok", `Booking ${next}.${refunded ? ` ${refunded} refunded.` : ""}${refundFailed ? " THE REFUND FAILED — please refund this payment in your Stripe or PayPal dashboard." : ""} ${mailed ? "The visitor has been emailed." : "(No email sent — email isn't configured or failed.)"}`);
}

export async function saveBookingNotes(fd: FormData) {
  const { db } = await guard();
  const id = parse(z.string().uuid(), str(fd, "bookingId"), "/admin/bookings");
  const path = `/admin/bookings/${id}`;
  const notes = parse(z.string().max(4000).nullable(), optStr(fd, "admin_notes"), path);
  const { error } = await db.from("bookings").update({ admin_notes: notes }).eq("id", id);
  if (error) back(path, "err", dbError(error));
  back(path, "ok", "Notes saved.");
}
