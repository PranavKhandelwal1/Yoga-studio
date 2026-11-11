import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Durable rate limit backed by Postgres (works across serverless instances).
 * Fails open on infrastructure errors so a database hiccup doesn't block real visitors; the
 * database-level uniqueness and capacity rules still protect data integrity.
 */
export async function rateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const ip = await clientIp();
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: `${bucket}:${ip}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}
