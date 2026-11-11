import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./configured";

/**
 * Cookie-less anonymous client for public, cacheable reads (ISR). RLS limits it to published content.
 * Returns null when Supabase isn't configured so the site still renders (with defaults / empty states).
 */
export function publicClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 60, tags: ["content"] } }) },
  });
}
