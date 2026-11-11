import { describe, expect, it } from "vitest";
import { cancelHours, canCancelOnline } from "@/lib/booking/policy";

const s = (h: unknown) => ({ booking: { cancel_hours: h as string, policy: "" } });

describe("cancellation policy", () => {
  it("reads the window from settings and falls back to 24h on bad input", () => {
    expect(cancelHours(s("48"))).toBe(48);
    expect(cancelHours(s("0"))).toBe(0);
    expect(cancelHours(s("abc"))).toBe(24);
    expect(cancelHours(s(""))).toBe(24);
    expect(cancelHours(s("-5"))).toBe(0);
    expect(cancelHours(s("99999"))).toBe(720);
  });
  it("allows cancelling only until the window closes", () => {
    const now = new Date("2026-06-01T10:00:00Z");
    expect(canCancelOnline("2026-06-02T11:00:00Z", 24, now)).toBe(true);  // 25h away
    expect(canCancelOnline("2026-06-02T10:00:00Z", 24, now)).toBe(true);  // exactly 24h
    expect(canCancelOnline("2026-06-02T09:59:00Z", 24, now)).toBe(false); // 23h59m
    expect(canCancelOnline("2026-06-01T09:00:00Z", 0, now)).toBe(false);  // already started
  });
});
