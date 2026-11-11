import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn(async () => true) }));
vi.mock("@/lib/email/send", async (orig) => ({ ...(await orig<typeof import("@/lib/email/send")>()), sendMail }));

import { confirmCheckoutSession, refundBooking, startCheckout } from "@/lib/payments/checkout";

const BOOKING = {
  id: "b1", reference: "ABC12345", full_name: "Ana", email: "ana@example.com", participants: 2, message: null, unit_price_cents: 1500, total_price_cents: 3000, currency: "EUR",
  payment_status: "paid", stripe_payment_intent: "pi_1",
  class_sessions: { starts_at: "2027-06-07T16:00:00Z", location_override: null, classes: { title: "Vinyasa", location_name: "Bodhana" } },
};
function fakeDb(rpcResult: unknown, booking: Record<string, unknown> | null = BOOKING) {
  const rpc = vi.fn(async (name: string) => (name === "confirm_booking_payment" ? { data: rpcResult, error: null } : { data: true, error: null }));
  const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: booking }) }) }), update }));
  return { db: { rpc, from } as never, rpc, update };
}
const session = (over: Record<string, unknown> = {}) => ({ id: "cs_test_123", payment_status: "paid", amount_total: 3000, payment_intent: "pi_1", metadata: { booking_id: "b1" }, ...over });
function fakeStripe(sess = session()) {
  const refunds = { create: vi.fn(async () => ({})) };
  const create = vi.fn(async (_args: Record<string, unknown>) => ({ id: "cs_new", url: "https://checkout.stripe.com/c/pay/cs_new" }));
  return { stripe: { checkout: { sessions: { retrieve: vi.fn(async () => sess), create } }, refunds } as never, refunds, create };
}
beforeEach(() => sendMail.mockClear());

describe("confirmCheckoutSession", () => {
  it("does nothing until Stripe says the session is paid", async () => {
    const { db, rpc } = fakeDb({}); const { stripe } = fakeStripe(session({ payment_status: "unpaid" }));
    expect((await confirmCheckoutSession(db, stripe, "cs_test_123")).state).toBe("unpaid");
    expect(rpc).not.toHaveBeenCalled(); expect(sendMail).not.toHaveBeenCalled();
  });
  it("takes the amount from STRIPE (never the browser) and emails customer + admin once", async () => {
    const { db, rpc } = fakeDb({ changed: true, status: "approved", needs_refund: false }); const { stripe } = fakeStripe();
    expect((await confirmCheckoutSession(db, stripe, "cs_test_123")).state).toBe("confirmed");
    expect(rpc).toHaveBeenCalledWith("confirm_booking_payment", { p_booking_id: "b1", p_session_id: "cs_test_123", p_payment_intent: "pi_1", p_amount: 3000 });
    expect(sendMail).toHaveBeenCalledTimes(2);
    const subjects = sendMail.mock.calls.map((c) => (c as unknown as [{ subject: string }])[0].subject);
    expect(subjects.some((s) => /confirmed/i.test(s))).toBe(true); expect(subjects.some((s) => /PAID/.test(s))).toBe(true);
  });
  it("is idempotent: a repeat call (webhook + success page) sends no second email", async () => {
    const { db } = fakeDb({ changed: false, status: "approved", needs_refund: false }); const { stripe } = fakeStripe();
    await confirmCheckoutSession(db, stripe, "cs_test_123");
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("refunds automatically when payment arrives for an already-cancelled booking", async () => {
    const { db, rpc } = fakeDb({ changed: true, status: "cancelled", needs_refund: true }); const { stripe, refunds } = fakeStripe();
    expect((await confirmCheckoutSession(db, stripe, "cs_test_123")).state).toBe("refunded");
    expect(refunds.create).toHaveBeenCalledWith(expect.objectContaining({ payment_intent: "pi_1" }), expect.anything());
    expect(rpc).toHaveBeenCalledWith("mark_booking_refunded", { p_booking_id: "b1" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect((sendMail.mock.calls[0] as unknown as [{ subject: string }])[0].subject).toMatch(/cancelled/i);
  });
  it("propagates database refusals (amount / session mismatch) so Stripe retries and nothing is confirmed", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "AMOUNT_MISMATCH" } }));
    await expect(confirmCheckoutSession({ rpc } as never, fakeStripe().stripe, "cs_test_123")).rejects.toThrow(/AMOUNT_MISMATCH/);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("startCheckout", () => {
  it("charges the price stored in the database × participants, in lowercase currency, with a ≥30-minute window", async () => {
    const { db, update } = fakeDb({}); const { stripe, create } = fakeStripe();
    const url = await startCheckout(db, stripe, "b1");
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_new");
    const args = create.mock.calls[0][0] as { line_items: { quantity: number; price_data: { currency: string; unit_amount: number } }[]; metadata: Record<string, string>; success_url: string; cancel_url: string; expires_at: number; mode: string };
    expect(args.mode).toBe("payment");
    expect(args.line_items[0]).toMatchObject({ quantity: 2, price_data: { currency: "eur", unit_amount: 1500 } });
    expect(args.metadata).toEqual({ booking_id: "b1", reference: "ABC12345" });
    expect(args.success_url).toContain("{CHECKOUT_SESSION_ID}"); expect(args.cancel_url).toContain("ABC12345");
    expect(args.expires_at - Date.now() / 1000).toBeGreaterThanOrEqual(30 * 60);
    expect(update).toHaveBeenCalledWith({ stripe_session_id: "cs_new" });
  });
  it("refuses to start a checkout for a booking with nothing to pay", async () => {
    const { db } = fakeDb({}, { ...BOOKING, unit_price_cents: null, total_price_cents: null });
    await expect(startCheckout(db, fakeStripe().stripe, "b1")).rejects.toThrow();
  });
});

describe("refundBooking", () => {
  it("refunds a paid booking once and records it", async () => {
    const { db, rpc } = fakeDb({}); const { stripe, refunds } = fakeStripe();
    expect(await refundBooking(db, stripe, "b1")).toBe(true);
    expect(refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_1", metadata: { booking_id: "b1" } }, { idempotencyKey: "refund-b1" });
    expect(rpc).toHaveBeenCalledWith("mark_booking_refunded", { p_booking_id: "b1" });
  });
  it("does nothing for unpaid bookings", async () => {
    const { db } = fakeDb({}, { ...BOOKING, payment_status: "unpaid" }); const { stripe, refunds } = fakeStripe();
    expect(await refundBooking(db, stripe, "b1")).toBe(false); expect(refunds.create).not.toHaveBeenCalled();
  });
  it("fails loudly if a refund is needed but Stripe isn't configured", async () => {
    await expect(refundBooking(fakeDb({}).db, null, "b1")).rejects.toThrow(/not configured/);
  });
});
