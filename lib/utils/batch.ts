import { addDays } from "./calendar";

export type BatchRange = "week" | "two_weeks" | "four_weeks" | "month" | "until";
export const RANGE_LABELS: [BatchRange, string][] = [
  ["week", "Whole week (7 days)"], ["two_weeks", "2 weeks"], ["four_weeks", "4 weeks"], ["month", "Rest of the month"], ["until", "Until a date I choose"],
];
export const MAX_BATCH_DAYS = 366;

const lastDayOfMonth = (k: string) => { const [y, m] = k.split("-").map(Number); return `${k.slice(0, 8)}${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`; };

/** Last day (inclusive) covered by a batch. */
export function batchEnd(start: string, range: BatchRange, until?: string): string {
  switch (range) {
    case "week": return addDays(start, 6);
    case "two_weeks": return addDays(start, 13);
    case "four_weeks": return addDays(start, 27);
    case "month": return lastDayOfMonth(start);
    default: return until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : start;
  }
}

/** Calendar days (YYYY-MM-DD) in the batch that fall on one of the chosen weekdays (0 = Sunday). Pure, so the form preview and the server agree. */
export function batchDates(start: string, range: BatchRange, weekdays: number[], until?: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  const end = batchEnd(start, range, until);
  const out: string[] = [];
  for (let i = 0; i < MAX_BATCH_DAYS; i++) {
    const key = addDays(start, i);
    if (key > end) break;
    if (weekdays.includes(new Date(`${key}T12:00:00Z`).getUTCDay())) out.push(key);
  }
  return out;
}
