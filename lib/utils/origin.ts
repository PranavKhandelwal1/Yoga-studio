import type { NextRequest } from "next/server";

/**
 * CSRF defence for cookie-less public JSON endpoints and form posts:
 * browsers always send Origin on cross-site POSTs; reject when it doesn't match our host.
 * (Admin mutations use Next.js Server Actions, which have built-in Origin checks.)
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl, server-to-server) — rate limiting still applies
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch { return false; }
}
