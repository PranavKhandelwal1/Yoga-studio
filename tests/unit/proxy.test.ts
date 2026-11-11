import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

afterEach(() => vi.unstubAllEnvs());
const call = async (path: string) => { const { proxy } = await import("@/proxy"); return proxy(new NextRequest(`https://bewithyoga.live${path}`)); };

describe("admin gate (proxy)", () => {
  it("redirects anonymous visitors from every /admin page to the login page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    for (const p of ["/admin/dashboard", "/admin/bookings", "/admin/classes/new", "/admin/newsletter/export", "/admin"]) {
      const r = await call(p); expect(r.status).toBe(307); expect(new URL(r.headers.get("location")!).pathname).toBe("/admin/login");
    }
  });
  it("lets the login page through", async () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); expect((await call("/admin/login")).headers.get("location")).toBeNull(); });
});
