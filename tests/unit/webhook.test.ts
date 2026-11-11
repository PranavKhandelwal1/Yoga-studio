import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ data: true, error: null })), confirm: vi.fn(async () => ({ state: "confirmed" })), event: null as unknown, bad: false }));
const { rpc, confirm } = h;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: h.rpc }) }));
vi.mock("@/lib/payments/checkout", () => ({ confirmCheckoutSession: h.confirm }));
vi.mock("@/lib/payments/stripe", () => ({ getStripe: () => ({ webhooks: { constructEvent: () => { if (h.bad) throw new Error("bad sig"); return h.event; } } }) }));

import { POST } from "@/app/api/stripe/webhook/route";
const post = (sig: string | null = "t=1,v1=x") => POST(new NextRequest("https://x.test/api/stripe/webhook", { method: "POST", body: "{}", headers: sig ? { "stripe-signature": sig } : {} }));

beforeEach(() => { rpc.mockClear(); confirm.mockClear(); h.bad = false; vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test"); });

describe("Stripe webhook", () => {
  it("rejects requests without a signature and with an invalid signature", async () => {
    expect((await post(null)).status).toBe(400);
    h.bad = true; expect((await post()).status).toBe(400);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("is disabled (503) when the webhook secret isn't configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", ""); expect((await post()).status).toBe(503);
  });
  it("confirms the booking on checkout.session.completed", async () => {
    h.event = { type: "checkout.session.completed", data: { object: { id: "cs_test_1" } } };
    expect((await post()).status).toBe(200); expect(confirm).toHaveBeenCalledWith(expect.anything(), expect.anything(), "cs_test_1");
  });
  it("releases the held seats when checkout expires", async () => {
    h.event = { type: "checkout.session.expired", data: { object: { id: "cs_test_2", metadata: { booking_id: "b9" } } } };
    expect((await post()).status).toBe(200); expect(rpc).toHaveBeenCalledWith("release_unpaid_booking", { p_booking_id: "b9" });
  });
  it("returns 500 (so Stripe retries) if confirming fails", async () => {
    confirm.mockRejectedValueOnce(new Error("db down"));
    h.event = { type: "checkout.session.completed", data: { object: { id: "cs_test_3" } } };
    expect((await post()).status).toBe(500);
  });
  it("ignores unrelated events", async () => {
    h.event = { type: "charge.succeeded", data: { object: {} } }; expect((await post()).status).toBe(200); expect(confirm).not.toHaveBeenCalled();
  });
});
