import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminUser = { id: string; email: string };

/** Returns the admin user or null. Verifies the JWT with Supabase AND the role in `profiles`. */
export async function getAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(); // validates token server-side
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return { id: user.id, email: user.email ?? "" };
}

/** For admin pages / layouts: redirect to login when not an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For server actions / route handlers: throw on unauthorised. */
export async function assertAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new Error("UNAUTHORIZED");
  return admin;
}
