import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn(async () => true) }));
vi.mock("@/lib/email/send", async (orig) => ({ ...(await orig<typeof import("@/lib/email/send")>()), sendMail }));

import { confirmPayPalOrder, refundBooking, startPayPalCheckout } from "@/lib/payments/checkout";
import { toCents } from "@/lib/payments/paypal";

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };
let calls: Call[] = [];
function stubPayPal(routes: Record<string, (c: Call) => { status?: number; json: unknown }>) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const c: Call = { url, method: init.method ?? "GET", body: init.body ? (() => { try { return JSON.parse(String(init.body)); } catch { return String(init.body); } })() : undefined, headers: (init.headers ?? {}) as Record<string, string> };
    calls.push(c);
    const key = Object.keys(routes).find((k) => `${c.method} ${new URL(url).pathname}`.startsWith(k));
    if (!key) return new Response("{}", { status: 404 });
    const r = routes[key](c);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }));
}
const TOKEN = { "POST /v1/oauth2/token": () => ({ json: { access_token: "tok", expires_in: 3000 } }) };
const BOOKING = {
  id: "b1", reference: "ABC12345", full_name: "Ana", email: "ana@example.com", participants: 2, message: null, unit_price_cents: 1500, total_price_cents: 3000, currency: "EUR",
  paypal_order_id: "ORDER12345", payment_status: "paid", payment_provider: "paypal", paypal_capture_id: "CAP1", stripe_payment_intent: null,
  class_sessions: { starts_at: "2027-06-07T16:00:00Z", location_override: null, classes: { title: "Vinyasa", location_name: "Bodhana", delivery: "online", class_private: { online_url: "https://meet.example/abc" } } },
};
function fakeDb(rpcResult: unknown, booking: Record<string, unknown> | null = BOOKING) {
  const rpc = vi.fn(async (name: string) => (name === "confirm_paypal_payment" ? { data: rpcResult, error: null } : { data: true, error: null }));
  const updates: unknown[] = [];
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: booking }) }) }), update: (v: unknown) => { updates.push(v); return { eq: async () => ({ error: null }) }; } }));
  return { db: { rpc, from } as never, rpc, updates };
}
const order = (status: string, cap?: { status?: string; value?: string; cur?: string }) => ({
  id: "ORDER12345", status,
  purchase_units: [{ custom_id: "b1", payments: cap ? { captures: [{ id: "CAP1", status: cap.status ?? "COMPLETED", amount: { value: cap.value ?? "30.00", currency_code: cap.cur ?? "EUR" } }] } : undefined }],
});

beforeEach(() => { process.env.PAYPAL_CLIENT_ID = "id"; process.env.PAYPAL_CLIENT_SECRET = "secret"; process.env.PAYPAL_ENV = "sandbox"; sendMail.mockClear(); });
afterEach(() => vi.unstubAllGlobals());

describe("PayPal", () => {
  it("converts PayPal decimal strings to cents without float drift", () => {
    expect(toCents("30.00")).toBe(3000); expect(toCents("19.99")).toBe(1999); expect(toCents("0.29")).toBe(29);
  });

  it("creates the order from the DATABASE amount and returns the approval link", async () => {
    stubPayPal({ ...TOKEN, "POST /v2/checkout/orders": () => ({ status: 201, json: { id: "ORDER12345", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER12345" }] } }) });
    const { db, updates } = fakeDb({});
    const url = await startPayPalCheckout(db, "b1");
    expect(url).toContain("paypal.com/checkoutnow");
    const create = calls.find((c) => c.url.endsWith("/v2/checkout/orders"))!;
    const pu = (create.body as { purchase_units: { amount: { value: string; currency_code: string }; custom_id: string }[] }).purchase_units[0];
    expect(pu.amount).toMatchObject({ value: "30.00", currency_code: "EUR" }); expect(pu.custom_id).toBe("b1");
    expect(create.headers["PayPal-Request-Id"]).toBe("order-b1");
    expect(updates).toContainEqual({ paypal_order_id: "ORDER12345", payment_provider: "paypal" });
  });

  it("captures an approved order on the server, then confirms and emails customer + admin once", async () => {
    stubPayPal({ ...TOKEN, "GET /v2/checkout/orders/ORDER12345": () => ({ json: order("APPROVED") }), "POST /v2/checkout/orders/ORDER12345/capture": () => ({ status: 201, json: order("COMPLETED", {}) }) });
    const { db, rpc } = fakeDb({ changed: true, status: "approved", needs_refund: false });
    expect((await confirmPayPalOrder(db, "ORDER12345")).state).toBe("confirmed");
    expect(calls.some((c) => c.url.endsWith("/capture"))).toBe(true);
    expect(rpc).toHaveBeenCalledWith("confirm_paypal_payment", { p_booking_id: "b1", p_order_id: "ORDER12345", p_capture_id: "CAP1", p_amount: 3000 });
    expect(sendMail).toHaveBeenCalledTimes(2);
    const html = sendMail.mock.calls.map((c) => (c as unknown as [{ html: string }])[0].html).join(" ");
    expect(html).toContain("https://meet.example/abc"); // private online link goes out only in the confirmation
  });

  it("does not confirm (or capture) an order the payer hasn't approved", async () => {
    stubPayPal({ ...TOKEN, "GET /v2/checkout/orders/ORDER12345": () => ({ json: order("CREATED") }) });
    const { db, rpc } = fakeDb({});
    expect((await confirmPayPalOrder(db, "ORDER12345")).state).toBe("unpaid");
    expect(rpc).not.toHaveBeenCalled(); expect(calls.some((c) => c.url.endsWith("/capture"))).toBe(false);
  });

  it("does not confirm a capture that is still PENDING review", async () => {
    stubPayPal({ ...TOKEN, "GET /v2/checkout/orders/ORDER12345": () => ({ json: order("COMPLETED", { status: "PENDING" }) }) });
    const { db, rpc } = fakeDb({});
    expect((await confirmPayPalOrder(db, "ORDER12345")).state).toBe("unpaid"); expect(rpc).not.toHaveBeenCalled();
  });

  it("is idempotent: a page refresh sends no second email", async () => {
    stubPayPal({ ...TOKEN, "GET /v2/checkout/orders/ORDER12345": () => ({ json: order("COMPLETED", {}) }) });
    const { db } = fakeDb({ changed: false, status: "approved", needs_refund: false });
    await confirmPayPalOrder(db, "ORDER12345");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("rejects a wrong currency and unknown orders", async () => {
    stubPayPal({ ...TOKEN, "GET /v2/checkout/orders/ORDER12345": () => ({ json: order("COMPLETED", { cur: "USD" }) }) });
    await expect(confirmPayPalOrder(fakeDb({}).db, "ORDER12345")).rejects.toThrow(/currency/);
    await expect(confirmPayPalOrder(fakeDb({}, null).db, "NOPE123456")).rejects.toThrow(/Unknown/);
  });

  it("passes PayPal's amount to the database, which refuses a mismatch", async () => {
    stubPayPal({ ...TOKEN, "GET /v2/checkout/orders/ORDER12345": () => ({ json: order("COMPLETED", { value: "1.00" }) }) });
    const { db, rpc } = fakeDb({ changed: false });
    await confirmPayPalOrder(db, "ORDER12345");
    expect(rpc).toHaveBeenCalledWith("confirm_paypal_payment", expect.objectContaining({ p_amount: 100 })); // DB compares with total_price_cents and raises AMOUNT_MISMATCH
  });

  it("refunds a late payment (booking was cancelled meanwhile) automatically", async () => {
    stubPayPal({ ...TOKEN, "GET /v2/checkout/orders/ORDER12345": () => ({ json: order("COMPLETED", {}) }), "POST /v2/payments/captures/CAP1/refund": () => ({ status: 201, json: { status: "COMPLETED" } }) });
    const { db, rpc } = fakeDb({ changed: true, status: "cancelled", needs_refund: true });
    expect((await confirmPayPalOrder(db, "ORDER12345")).state).toBe("refunded");
    expect(calls.some((c) => c.url.endsWith("/captures/CAP1/refund"))).toBe(true);
    expect(rpc).toHaveBeenCalledWith("mark_booking_refunded", { p_booking_id: "b1" });
  });

  it("refundBooking routes PayPal payments to the PayPal refund API", async () => {
    stubPayPal({ ...TOKEN, "POST /v2/payments/captures/CAP1/refund": () => ({ status: 201, json: { status: "COMPLETED" } }) });
    const { db, rpc } = fakeDb({});
    expect(await refundBooking(db, null, "b1")).toBe(true);
    expect(calls.find((c) => c.url.endsWith("/refund"))!.headers["PayPal-Request-Id"]).toBe("refund-b1");
    expect(rpc).toHaveBeenCalledWith("mark_booking_refunded", { p_booking_id: "b1" });
  });

  it("surfaces PayPal API failures instead of pretending to refund", async () => {
    stubPayPal({ ...TOKEN, "POST /v2/payments/captures/CAP1/refund": () => ({ status: 422, json: { message: "nope" } }) });
    await expect(refundBooking(fakeDb({}).db, null, "b1")).rejects.toThrow(/refund failed/);
  });
});
