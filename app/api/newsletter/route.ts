import { NextResponse, type NextRequest } from "next/server";
import { newsletterSchema } from "@/lib/validation/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/utils/origin";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await rateLimit("newsletter", 5, 600))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = newsletterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 422 });
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const db = createAdminClient();
  const email = parsed.data.email;
  const { error } = await db.from("newsletter_subscribers").insert({ email, source: "website" });
  if (error?.code === "23505") {
    // Already on the list: re-activate if they had unsubscribed. Same response either way (no enumeration).
    await db.from("newsletter_subscribers").update({ status: "subscribed", unsubscribed_at: null }).ilike("email", email.replace(/[\\%_]/g, "\\$&"));
  } else if (error) {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
