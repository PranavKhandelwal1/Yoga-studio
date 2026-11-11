import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import type { ZodType } from "zod";
import { assertAdmin, type AdminUser } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Every admin server action starts here: verifies the signed-in user is an admin (server-side,
 * against the `profiles` table) and returns a USER-scoped Supabase client, so Row Level Security
 * is enforced a second time by the database. The service-role key is never used for admin writes.
 */
export async function guard() {
  let admin: AdminUser;
  try { admin = await assertAdmin(); } catch { redirect("/admin/login"); }
  return { admin, db: await createClient() };
}

export type Flash = "ok" | "err";
/** Redirect back to a page with a one-shot message shown by <Flash/>. */
export function back(path: string, kind: Flash, message: string): never {
  const u = new URL(path, "http://x");
  u.searchParams.set(kind, message);
  redirect(u.pathname + u.search);
}

export function revalidateSite() {
  updateTag("content");
  revalidatePath("/", "layout");
}

export const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const int = (fd: FormData, k: string, d = 0) => { const n = parseInt(str(fd, k), 10); return Number.isFinite(n) ? n : d; };
/** "25" or "25,50" euros → cents; empty → null. */
export const cents = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};

export function parse<T>(schema: ZodType<T>, data: unknown, path: string): T {
  const r = schema.safeParse(data);
  if (!r.success) back(path, "err", r.error.issues[0]?.message ? `${r.error.issues[0].path.join(".") || "Form"}: ${r.error.issues[0].message}` : "Invalid form");
  return r.data;
}

/** Postgres/PostgREST error → friendly flash text. */
export function dbError(e: { message: string; code?: string } | null): string {
  if (!e) return "";
  if (e.code === "23505") return "That value already exists (duplicate).";
  if (e.code === "23503") return "This item is still referenced by other records (e.g. bookings) and can't be deleted. Archive or cancel it instead.";
  if (e.code === "42501" || /row-level security/i.test(e.message)) return "Not permitted.";
  if (/PUBLISH_REQUIRES_SESSION/.test(e.message)) return "A class can only be published once it has at least one upcoming date. Add a date first.";
  if (/CAPACITY_BELOW_BOOKED_SEATS/.test(e.message)) return "Capacity can't be lower than the seats already booked.";
  if (/INVALID_STATUS_TRANSITION/.test(e.message)) return "That status change isn't allowed for this booking.";
  return e.message;
}
