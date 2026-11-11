"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Video } from "lucide-react";
import { fmtTime, madridDateKey, formatMinutes } from "@/lib/utils/time";
import { addDays, addMonths, labelDay, monthGrid, sameMonth, startOfMonth, startOfWeek, weekDays } from "@/lib/utils/calendar";

export type CalSession = {
  id: string; classSlug: string; classTitle: string; startsAt: string; endsAt: string;
  seatsLeft: number; capacity: number; cancelled: boolean; location: string | null; online: boolean;
};
type View = "list" | "week" | "month";

const isBookable = (s: CalSession, nowMs: number) => !s.cancelled && s.seatsLeft > 0 && new Date(s.startsAt).getTime() > nowMs;

function Availability({ s, nowMs }: { s: CalSession; nowMs: number }) {
  if (s.cancelled) return <span className="text-xs font-medium text-[#8c2f2f]">Cancelled</span>;
  if (new Date(s.startsAt).getTime() <= nowMs) return <span className="text-xs text-ink-soft">Past</span>;
  if (s.seatsLeft <= 0) return <span className="text-xs font-medium text-[#8c2f2f]">Full</span>;
  return <span className="text-xs font-medium text-forest">{s.seatsLeft} {s.seatsLeft === 1 ? "place" : "places"} left</span>;
}

function SessionRow({ s, nowMs }: { s: CalSession; nowMs: number }) {
  const ok = isBookable(s, nowMs);
  const mins = Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000);
  return (
    <li className={`flex flex-col gap-3 border-b border-sage/50 py-4 sm:flex-row sm:items-center sm:justify-between ${s.cancelled ? "opacity-60" : ""}`}>
      <div>
        <p className={`font-serif text-2xl text-deep ${s.cancelled ? "line-through" : ""}`}>
          <Link href={`/classes/${s.classSlug}`} className="hover:text-forest">{s.classTitle}</Link>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Clock size={15} />{fmtTime(s.startsAt)}–{fmtTime(s.endsAt)} · {formatMinutes(mins)}</span>
          {s.online ? <span className="inline-flex items-center gap-1.5 font-medium text-forest"><Video size={15} />Online{s.location && s.location !== "Online" ? ` · ${s.location}` : ""}</span> : s.location && <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{s.location}</span>}
        </p>
      </div>
      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1.5">
        <Availability s={s} nowMs={nowMs} />
        {ok && <Link href={`/book?session=${s.id}`} className="btn btn-primary btn-sm">Book</Link>}
      </div>
    </li>
  );
}

export function ScheduleCalendar({ sessions: allSessions, todayKey, nowMs }: { sessions: CalSession[]; todayKey: string; nowMs: number }) {
  const [view, setView] = useState<View>("list");
  const [fmt, setFmt] = useState<"all" | "in_person" | "online">("all");
  const hasOnline = allSessions.some((s) => s.online), hasInPerson = allSessions.some((s) => !s.online);
  const sessions = useMemo(() => (fmt === "all" ? allSessions : allSessions.filter((s) => (fmt === "online") === s.online)), [allSessions, fmt]);
  const [anchor, setAnchor] = useState(todayKey);
  const [selected, setSelected] = useState<string>(todayKey);

  const byDay = useMemo(() => {
    const m = new Map<string, CalSession[]>();
    for (const s of sessions) { const k = madridDateKey(s.startsAt); (m.get(k) ?? m.set(k, []).get(k)!).push(s); }
    for (const list of m.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  }, [sessions]);

  const upcoming = useMemo(() => sessions.filter((s) => new Date(s.endsAt).getTime() > nowMs).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [sessions, nowMs]);
  const step = (dir: -1 | 1) => setAnchor((a) => (view === "month" ? addMonths(a, dir) : addDays(a, dir * 7)));
  const title = view === "month" ? labelDay(startOfMonth(anchor), { month: "long", year: "numeric" })
    : `${labelDay(startOfWeek(anchor), { day: "numeric", month: "short" })} – ${labelDay(addDays(startOfWeek(anchor), 6), { day: "numeric", month: "short", year: "numeric" })}`;

  const tabs: [View, string][] = [["list", "Upcoming"], ["week", "Week"], ["month", "Month"]];

  return (
    <div>
      {hasOnline && hasInPerson && (
        <div role="group" aria-label="Class format" className="mb-4 flex flex-wrap gap-2">
          {([["all", "All classes"], ["in_person", "In person"], ["online", "Online"]] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={fmt === v} onClick={() => setFmt(v)} className={`min-h-10 border px-4 text-[0.8125rem] ${fmt === v ? "border-deep bg-deep text-cream" : "border-sage hover:bg-sage/30"}`}>{l}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sage/60 pb-4">
        <div role="tablist" aria-label="Schedule view" className="flex gap-1">
          {tabs.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`min-h-11 px-4 text-[0.8125rem] transition-colors ${view === v ? "bg-forest text-cream" : "text-charcoal hover:bg-sage/30"}`}>{l}</button>
          ))}
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-2">
            <button aria-label="Previous" onClick={() => step(-1)} className="flex h-11 w-11 items-center justify-center border border-sage hover:bg-sage/30"><ChevronLeft size={20} /></button>
            <p className="min-w-[10.5rem] text-center font-serif text-xl text-deep" aria-live="polite">{title}</p>
            <button aria-label="Next" onClick={() => step(1)} className="flex h-11 w-11 items-center justify-center border border-sage hover:bg-sage/30"><ChevronRight size={20} /></button>
            <button onClick={() => { setAnchor(todayKey); setSelected(todayKey); }} className="btn btn-outline btn-sm ml-1">Today</button>
          </div>
        )}
      </div>

      {view === "list" && (
        upcoming.length === 0 ? <Empty /> : (
          <ul>
            {upcoming.map((s, i) => {
              const k = madridDateKey(s.startsAt);
              const newDay = i === 0 || madridDateKey(upcoming[i - 1].startsAt) !== k;
              return (
                <li key={s.id} className="list-none">
                  {newDay && <h3 className="mt-8 border-b border-forest/40 pb-2 font-serif text-3xl text-deep">{labelDay(k, { weekday: "long", day: "numeric", month: "long" })}</h3>}
                  <ul><SessionRow s={s} nowMs={nowMs} /></ul>
                </li>
              );
            })}
          </ul>
        )
      )}

      {view === "week" && (
        <div className="mt-6 grid gap-px bg-sage/50 md:grid-cols-7">
          {weekDays(anchor).map((k) => {
            const list = byDay.get(k) ?? [];
            return (
              <section key={k} aria-label={labelDay(k, { weekday: "long", day: "numeric", month: "long" })} className={`min-h-[7rem] bg-cream p-3 md:min-h-[16rem] ${k === todayKey ? "ring-2 ring-inset ring-forest" : ""}`}>
                <h3 className="font-sans text-xs text-forest">{labelDay(k, { weekday: "short" })} <span className="text-base text-deep">{labelDay(k, { day: "numeric" })}</span></h3>
                {list.length === 0 ? <p className="mt-2 text-sm text-ink-soft md:hidden">No classes</p> : (
                  <ul className="mt-2 space-y-2">
                    {list.map((s) => (
                      <li key={s.id} className={`border-l-2 pl-2 text-sm ${s.cancelled ? "border-[#8c2f2f] opacity-60" : "border-forest"}`}>
                        <p className="font-medium text-deep">{fmtTime(s.startsAt)} · <Link href={`/classes/${s.classSlug}`} className={s.cancelled ? "line-through" : "hover:underline"}>{s.classTitle}</Link></p>
                        <p className="mt-0.5"><Availability s={s} nowMs={nowMs} /></p>
                        {isBookable(s, nowMs) && <Link href={`/book?session=${s.id}`} className="mt-1 inline-block text-xs font-medium text-forest underline underline-offset-4">Book</Link>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <div className="mt-6">
          <div className="grid grid-cols-7 gap-px text-center text-xs text-forest" aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px bg-sage/50">
            {monthGrid(anchor).map((k) => {
              const list = byDay.get(k) ?? [];
              const inMonth = sameMonth(k, anchor);
              const sel = k === selected;
              return (
                <button key={k} type="button" onClick={() => setSelected(k)} aria-pressed={sel}
                  aria-label={`${labelDay(k, { weekday: "long", day: "numeric", month: "long" })}: ${list.length} ${list.length === 1 ? "class" : "classes"}`}
                  className={`min-h-[3.75rem] bg-cream p-1.5 text-left align-top transition-colors hover:bg-sage/20 md:min-h-[6.5rem] md:p-2 ${inMonth ? "" : "opacity-40"} ${sel ? "ring-2 ring-inset ring-forest" : ""}`}>
                  <span className={`block text-sm ${k === todayKey ? "font-semibold text-forest" : "text-charcoal"}`}>{labelDay(k, { day: "numeric" })}</span>
                  <span className="mt-1 hidden space-y-1 md:block">
                    {list.slice(0, 2).map((s) => <span key={s.id} className={`block truncate border-l-2 pl-1.5 text-xs ${s.cancelled ? "border-[#8c2f2f] line-through opacity-60" : "border-forest"}`}>{fmtTime(s.startsAt)} {s.classTitle}</span>)}
                    {list.length > 2 && <span className="block text-xs text-ink-soft">+{list.length - 2} more</span>}
                  </span>
                  {list.length > 0 && <span className="mt-1 flex gap-0.5 md:hidden">{list.slice(0, 4).map((s) => <span key={s.id} className="h-1.5 w-1.5 rounded-full bg-forest" />)}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-8">
            <h3 className="font-serif text-3xl text-deep">{labelDay(selected, { weekday: "long", day: "numeric", month: "long" })}</h3>
            {(byDay.get(selected) ?? []).length === 0 ? <p className="mt-3 text-ink-soft">No classes on this day.</p> : <ul>{(byDay.get(selected) ?? []).map((s) => <SessionRow key={s.id} s={s} nowMs={nowMs} />)}</ul>}
          </div>
        </div>
      )}
      <p className="mt-8 text-sm text-ink-soft">All times are Mallorca local time (Europe/Madrid).</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-10 border border-sage/60 bg-white/50 p-8 text-center">
      <p className="font-serif text-2xl text-deep">No upcoming classes are scheduled yet.</p>
      <p className="mt-2 text-ink-soft">New dates are added regularly — <Link href="/contact" className="underline underline-offset-4">get in touch</Link> or subscribe below to hear first.</p>
    </div>
  );
}
