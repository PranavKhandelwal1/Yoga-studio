import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Completes the Supabase PKCE password-reset link: exchanges ?code= for a session, then redirects (same-site paths only). */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin/reset-password";
  const safe = next.startsWith("/admin/") && !next.startsWith("//") ? next : "/admin/reset-password";
  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safe}`);
  }
  return NextResponse.redirect(`${origin}/admin/login?err=${encodeURIComponent("That link is invalid or has expired.")}`);
}
