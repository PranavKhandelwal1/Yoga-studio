import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/utils/origin";

const schema = z.object({ reference: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,16}$/), email: z.string().trim().toLowerCase().email().max(254) });

/** "Find my booking": needs BOTH the reference and the email used, so nobody can browse other people's bookings. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await rateLimit("lookup", 10, 600))) return NextResponse.json({ error: "Too many searches. Please try again in a few minutes." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your booking reference (from your email) and the email address you booked with." }, { status: 422 });
  const { data } = await createAdminClient().from("bookings")
    .select("reference,email,full_name,participants,status,payment_status,total_price_cents,currency,class_sessions(starts_at,ends_at,classes(title,location_name,delivery))")
    .eq("reference", parsed.data.reference).maybeSingle();
  if (!data || data.email.toLowerCase() !== parsed.data.email) return NextResponse.json({ error: "We couldn't find a booking with that reference and email." }, { status: 404 });
  const { email: _e, ...safe } = data; void _e;
  return NextResponse.json({ ok: true, booking: safe });
}
