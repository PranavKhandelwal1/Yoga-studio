"use client";
import { useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Submit } from "./Buttons";
import { aInput } from "./ui";
import { addBatch } from "@/app/admin/(panel)/classes/actions";
import { RANGE_LABELS, batchDates, type BatchRange } from "@/lib/utils/batch";

const DAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const PRESETS: [string, number[]][] = [["Mon–Fri", [1, 2, 3, 4, 5]], ["Every day", [0, 1, 2, 3, 4, 5, 6]], ["Weekends", [6, 0]], ["Mon · Wed · Fri", [1, 3, 5]], ["Tue · Thu", [2, 4]]];

/** One form that creates the same class at the same time(s) on every chosen weekday across a whole week, month or custom period. */
export function BatchScheduler({ classId, duration, capacity, isDraft, today }: { classId: string; duration: number; capacity: number; isDraft: boolean; today: string }) {
  const [start, setStart] = useState(today);
  const [range, setRange] = useState<BatchRange>("month");
  const [until, setUntil] = useState("");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [t1, setT1] = useState(""); const [t2, setT2] = useState("");
  const slots = [t1, t2].filter(Boolean).length;
  const dates = useMemo(() => batchDates(start, range, days, until), [start, range, days, until]);
  const total = dates.length * slots;
  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  return (
    <form action={addBatch} className="space-y-5">
      <input type="hidden" name="class_id" value={classId} />
      {days.map((d) => <input key={d} type="hidden" name="weekday" value={d} />)}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-deep">Which days?</legend>
        <div className="mb-2 flex flex-wrap gap-2">{PRESETS.map(([l, v]) => <button key={l} type="button" onClick={() => setDays(v)} className="min-h-9 border border-sage px-3 text-xs hover:bg-sage/25">{l}</button>)}</div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(([v, l]) => { const on = days.includes(v); return (
            <button key={v} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(v)} className={`min-h-11 min-w-14 border px-3 text-sm transition-colors ${on ? "border-forest bg-forest text-cream" : "border-[#dccfb8] bg-white hover:border-forest"}`}>{l}</button>); })}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium text-deep">Starting on</span><input type="date" name="start_date" value={start} min={today} onChange={(e) => setStart(e.target.value)} required className={aInput} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-deep">For how long?</span>
          <select name="range" value={range} onChange={(e) => setRange(e.target.value as BatchRange)} className={aInput}>{RANGE_LABELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        {range === "until" && <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-medium text-deep">Last date</span><input type="date" name="until" value={until} min={start} onChange={(e) => setUntil(e.target.value)} required className={aInput} /></label>}
        <label className="block"><span className="mb-1 block text-sm font-medium text-deep">Class time</span><input type="time" name="time" value={t1} onChange={(e) => setT1(e.target.value)} required className={aInput} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-deep">Second class time <span className="font-normal text-ink-soft">(optional)</span></span><input type="time" name="time2" value={t2} onChange={(e) => setT2(e.target.value)} className={aInput} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-deep">Duration (min)</span><input type="number" name="duration_minutes" defaultValue={duration} min={10} max={600} className={aInput} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-deep">Places per class</span><input type="number" name="capacity" defaultValue={capacity} min={1} max={500} className={aInput} /></label>
      </div>
      {isDraft && <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="publish" defaultChecked className="h-4 w-4 accent-[#43301f]" />Publish this class once the dates are created</label>}
      <div aria-live="polite" className="border-l-4 border-forest bg-sage/20 px-4 py-3 text-sm">
        {total > 0 ? <>This will create <strong>{total}</strong> session{total === 1 ? "" : "s"} ({dates.length} day{dates.length === 1 ? "" : "s"}{slots > 1 ? " × 2 times" : ""}), {dates[0]} → {dates[dates.length - 1]}. Dates that already exist or are in the past are skipped.</> : <>Choose at least one day and a time to see how many sessions will be created.</>}
      </div>
      <Submit><CalendarPlus size={16} aria-hidden />Create {total > 0 ? total : ""} session{total === 1 ? "" : "s"}</Submit>
    </form>
  );
}
