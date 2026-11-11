import { NextResponse, type NextRequest } from "next/server";
import { privateSessionSchema } from "@/lib/validation/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/utils/origin";
import { adminNotice, sendMail } from "@/lib/email/send";

const FORMAT = { in_person: "In person", online: "Online", either: "Either in person or online" } as const;

/** Private-session requests arrive in the admin "Messages" inbox, clearly labelled. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await rateLimit("private-session", 5, 600))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = privateSessionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form.", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true });

  const message = [
    `Format: ${FORMAT[d.format]}`, `People: ${d.participants}`,
    d.preferred ? `Preferred days/times: ${d.preferred}` : null,
    d.goals ? `What they're looking for: ${d.goals}` : null,
  ].filter(Boolean).join("\n");
  const { error } = await createAdminClient().from("contact_messages").insert({ name: d.name, email: d.email, phone: d.phone ?? null, subject: "Private session request", message, privacy_consent: true });
  if (error) return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  await sendMail(adminNotice(`Private session request from ${d.name}`, [`${d.name} <${d.email}>${d.phone ? ` · ${d.phone}` : ""}`, ...message.split("\n")], d.email));
  return NextResponse.json({ ok: true }, { status: 201 });
}
