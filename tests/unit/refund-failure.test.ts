import { describe, expect, it, vi, beforeEach } from "vitest";

const sent: { subject: string }[] = [];
vi.mock("@/lib/email/send", () => ({
  sendMail: vi.fn(async (m: { subject: string }) => { sent.push(m); return true; }),
  adminNotice: (subject: string) => ({ to: "admin@example.com", subject, html: "" }),
  adminNewBooking: () => ({ subject: "new" }), visitorApproved: () => ({ subject: "approved" }), visitorCancelled: () => ({ subject: "cancelled" }),
}));
vi.mock("@/lib/payments/paypal", () => ({ captureOrder: vi.fn(), createOrder: vi.fn(), getOrder: vi.fn(), refundCapture: vi.fn(), toCents: Number }));
vi.mock("@/lib/payments/retreat", () => ({ confirmRetreatPayPal: vi.fn(), confirmRetreatStripe: vi.fn() }));

import { confirmCheckoutSession } from "@/lib/payments/checkout";

const booking = { id: "b1", reference: "ABC12345", full_name: "A", email: "a@b.co", participants: 1, message: null, unit_price_cents: 1500, total_price_cents: 1500, currency: "EUR", class_sessions: null };

function fakeDb(rpcResult: unknown) {
  const rpc = vi.fn(async (name: string) => ({ data: name === "confirm_booking_payment" ? rpcResult : null, error: null }));
  const db = { rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: booking }) }) }) }) };
  return { db: db as never, rpc };
}
const stripeWith = (refund: () => Promise<unknown>) => ({
  checkout: { sessions: { retrieve: async () => ({ id: "cs_1", payment_status: "paid", payment_intent: "pi_1", amount_total: 1500, metadata: { booking_id: "b1" } }) } },
  refunds: { create: refund },
}) as never;

describe("late payment on a cancelled booking", () => {
  beforeEach(() => { sent.length = 0; });

  it("refunds it and marks it refunded", async () => {
    const { db, rpc } = fakeDb({ changed: true, status: "cancelled", needs_refund: true });
    const refund = vi.fn(async () => ({}));
    const r = await confirmCheckoutSession(db, stripeWith(refund), "cs_1");
    expect(r.state).toBe("refunded");
    expect(refund).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("mark_booking_refunded", { p_booking_id: "b1" });
  });

  it("alerts the admin and does NOT mark it refunded when the refund call fails", async () => {
    const { db, rpc } = fakeDb({ changed: true, status: "cancelled", needs_refund: true });
    const r = await confirmCheckoutSession(db, stripeWith(async () => { throw new Error("network"); }), "cs_1");
    expect(r.state).toBe("refunded");
    expect(sent.some((m) => m.subject.startsWith("REFUND FAILED"))).toBe(true);
    expect(rpc).not.toHaveBeenCalledWith("mark_booking_refunded", expect.anything());
  });
});
