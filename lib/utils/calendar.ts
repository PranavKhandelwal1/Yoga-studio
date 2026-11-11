/** Calendar arithmetic on "YYYY-MM-DD" keys (Madrid local dates). Uses noon-UTC dates so DST never shifts the day. */
const toDate = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const toKey = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (k: string, n: number) => { const d = toDate(k); d.setUTCDate(d.getUTCDate() + n); return toKey(d); };
export const addMonths = (k: string, n: number) => { const d = toDate(k); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return toKey(d); };
/** Monday-based week start. */
export const startOfWeek = (k: string) => addDays(k, -((toDate(k).getUTCDay() + 6) % 7));
export const startOfMonth = (k: string) => `${k.slice(0, 7)}-01`;
export const weekDays = (k: string) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(k), i));
/** 6-week (or 5-week) grid of day keys covering the month containing k. */
export function monthGrid(k: string) {
  const first = startOfMonth(k);
  const start = startOfWeek(first);
  const last = addDays(addMonths(first, 1), -1);
  const weeks = Math.ceil(((toDate(last).getTime() - toDate(start).getTime()) / 864e5 + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}
export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);
export const labelDay = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(toDate(k));
