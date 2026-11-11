import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Request-scoped client acting as the signed-in user (or anonymous). RLS applies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; session refresh is handled by proxy.ts.
          }
        },
      },
    },
  );
}
