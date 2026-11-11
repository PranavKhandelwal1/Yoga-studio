export const TZ = "Europe/Madrid";

/** Formats an ISO instant in Mallorca local time. */
export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(iso));
}

export function fmtTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

export function fmtDateTime(iso: string | Date) {
  return `${fmtDate(iso, { weekday: "short", year: undefined })} · ${fmtTime(iso)}`;
}

/** "YYYY-MM-DD" of an instant as seen in Madrid. */
export function madridDateKey(iso: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Offset (ms) of Madrid relative to UTC at a given instant. */
function madridOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Converts a Mallorca wall-clock date ("YYYY-MM-DD") + time ("HH:MM") to a UTC Date. DST-safe. */
export function madridLocalToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - madridOffsetMs(new Date(guess));
  utc = guess - madridOffsetMs(new Date(utc)); // second pass handles DST boundaries
  return new Date(utc);
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
