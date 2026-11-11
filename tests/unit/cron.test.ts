import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({
  claimed: [{ booking_id: "b1" }, { booking_id: "b2" }] as { booking_id: string }[],
  update: vi.fn(), send: vi.fn(async (m: { to: string }) => m.to !== "fail@x.dev"), claimErr: null as unknown,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  rpc: async () => ({ data: h.claimed, error: h.claimErr }),
  from: () => ({ update: (v: unknown) => ({ eq: async (_c: string, id: string) => { h.update(v, id); return {}; } }) }),
}) }));
vi.mock("@/lib/payments/checkout", () => ({ loadBooking: async (_db: unknown, id: string) => ({ id }), toMailData: (b: { id: string }) => ({ to: b.id === "b2" ? "fail@x.dev" : "ok@x.dev" }) }));
vi.mock("@/lib/email/send", () => ({ sendMail: h.send, visitorReminder: (d: unknown) => d }));

import { GET } from "@/app/api/cron/reminders/route";
const call = (auth?: string) => GET(new NextRequest("https://x.test/api/cron/reminders", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => { h.update.mockClear(); h.send.mockClear(); h.claimErr = null; vi.stubEnv("CRON_SECRET", "s3cret"); });

describe("reminder cron", () => {
  it("refuses to run without the secret, with a wrong secret, or when no secret is configured", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", ""); expect((await call("Bearer ")).status).toBe(401);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("sends one email per claimed booking and releases the claim when a send fails", async () => {
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ ok: true, sent: 1, failed: 1 });
    expect(h.send).toHaveBeenCalledTimes(2);
    expect(h.update).toHaveBeenCalledWith({ reminder_sent_at: null }, "b2"); // retried on the next run
  });
  it("returns 500 if claiming fails, sending nothing", async () => {
    h.claimErr = { message: "db down" };
    expect((await call("Bearer s3cret")).status).toBe(500);
    expect(h.send).not.toHaveBeenCalled();
  });
});
