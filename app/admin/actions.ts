"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { loginSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/utils/format";
import { z } from "zod";

function go(p: string, kind: "err" | "ok", m: string): never { redirect(`${p}?${kind}=${encodeURIComponent(m)}`); }
const GENERIC = "Invalid email or password.";

export async function login(formData: FormData) {
  if (!isSupabaseConfigured()) go("/admin/login", "err", "Supabase is not configured. See the setup guide.");
  if (!(await rateLimit("admin-login", 10, 900))) go("/admin/login", "err", "Too many attempts. Please wait 15 minutes.");
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) go("/admin/login", "err", GENERIC);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) go("/admin/login", "err", GENERIC);
  // Only admins may hold an admin session. Everyone else is signed straight back out.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") { await supabase.auth.signOut(); go("/admin/login", "err", GENERIC); }
  redirect("/admin/dashboard");
}

export async function logout() {
  if (isSupabaseConfigured()) await (await createClient()).auth.signOut();
  redirect("/admin/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = z.string().email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (isSupabaseConfigured() && email.success && (await rateLimit("admin-reset", 5, 900))) {
    const h = await headers();
    const origin = h.get("origin") ?? SITE_URL;
    await (await createClient()).auth.resetPasswordForEmail(email.data, { redirectTo: `${origin}/admin/auth/callback?next=/admin/reset-password` });
  }
  // Identical response whether or not the account exists (no user enumeration).
  go("/admin/forgot-password", "ok", "If an account exists for that email, a reset link is on its way.");
}

export async function updatePassword(formData: FormData) {
  const pw = z.string().min(12, "Use at least 12 characters").max(200).safeParse(formData.get("password"));
  if (!pw.success) go("/admin/reset-password", "err", pw.error.issues[0].message);
  if (formData.get("password") !== formData.get("confirm")) go("/admin/reset-password", "err", "Passwords don't match.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) go("/admin/login", "err", "Your reset link has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) go("/admin/reset-password", "err", error.message);
  redirect("/admin/dashboard");
}
