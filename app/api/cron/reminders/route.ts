import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBooking, toMailData } from "@/lib/payments/checkout";
import { sendMail, visitorReminder } from "@/lib/email/send";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const WINDOW_HOURS = 30; // run once a day: covers every class starting within the next ~day, with a little overlap

function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run unauthenticated
  const got = Buffer.from(req.headers.get("authorization") ?? ""); const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Daily reminder emails for confirmed bookings. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`
 * (see vercel.json). Each booking is claimed atomically in the database, so overlapping runs can't double-send;
 * if an email fails to send the claim is released so the next run retries.
 */
export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_booking_reminders", { p_hours: WINDOW_HOURS });
  if (error) { console.error("[reminders] claim failed", error.message); return NextResponse.json({ error: "Claim failed" }, { status: 500 }); }
  let sent = 0; let failed = 0;
  for (const row of (data ?? []) as { booking_id: string }[]) {
    const b = await loadBooking(db, row.booking_id);
    const ok = b ? await sendMail(visitorReminder(toMailData(b))) : false;
    if (ok) sent++; else { failed++; await db.from("bookings").update({ reminder_sent_at: null }).eq("id", row.booking_id); }
  }
  return NextResponse.json({ ok: true, sent, failed });
}
