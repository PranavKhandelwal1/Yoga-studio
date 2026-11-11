import type { Settings } from "@/types/db";

/** Hours before a class until which a guest may cancel online for a full refund. Falls back to 24 on bad input. */
export function cancelHours(s: Pick<Settings, "booking">): number {
  const n = Number.parseInt(String(s.booking?.cancel_hours ?? "24"), 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 24 * 30) : 24;
}

/** True while a guest may still cancel online (class starts at least `hours` from `now`). */
export const canCancelOnline = (startsAt: string | Date, hours: number, now: Date = new Date()) =>
  new Date(startsAt).getTime() - now.getTime() >= hours * 3_600_000;
