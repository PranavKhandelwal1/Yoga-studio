import { NextResponse, type NextRequest } from "next/server";
import { contactSchema } from "@/lib/validation/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/utils/origin";
import { adminNotice, sendMail } from "@/lib/email/send";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await rateLimit("contact", 5, 600))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = contactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form.", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true });

  const { error } = await createAdminClient().from("contact_messages").insert({
    name: d.name, email: d.email, phone: d.phone ?? null, subject: d.subject ?? null,
    message: d.message, privacy_consent: true,
  });
  if (error) return NextResponse.json({ error: "Something went wrong." }, { status: 500 });

  await sendMail(adminNotice(`New message from ${d.name}`, [`${d.name} <${d.email}>`, d.subject ?? "", d.message], d.email));
  return NextResponse.json({ ok: true }, { status: 201 });
}
