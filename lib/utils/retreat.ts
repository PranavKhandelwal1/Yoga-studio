import type { RetreatRow } from "@/types/db";

const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(new Date(d + "T12:00:00Z"));

export function retreatDates(r: Pick<RetreatRow, "start_date" | "end_date">) {
  if (!r.start_date) return "Dates to be announced";
  if (!r.end_date || r.end_date === r.start_date) return f(r.start_date, { day: "numeric", month: "long", year: "numeric" });
  const sameMonth = r.start_date.slice(0, 7) === r.end_date.slice(0, 7);
  return sameMonth
    ? `${f(r.start_date, { day: "numeric" })}–${f(r.end_date, { day: "numeric", month: "long", year: "numeric" })}`
    : `${f(r.start_date, { day: "numeric", month: "long" })} – ${f(r.end_date, { day: "numeric", month: "long", year: "numeric" })}`;
}
export function retreatDuration(r: Pick<RetreatRow, "start_date" | "end_date">) {
  if (!r.start_date || !r.end_date) return null;
  const days = Math.round((Date.parse(r.end_date) - Date.parse(r.start_date)) / 864e5) + 1;
  return days === 1 ? "1 day" : `${days} days / ${days - 1} nights`;
}
/** null = unlimited / not tracked */
export function placesLeft(r: Pick<RetreatRow, "capacity" | "places_taken">) {
  return r.capacity == null ? null : Math.max(0, r.capacity - r.places_taken);
}
