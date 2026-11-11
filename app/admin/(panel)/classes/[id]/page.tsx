import { notFound } from "next/navigation";
import { AdminTitle, Badge, Card, Check, Empty, Flash, TextIn, aInput } from "@/components/admin/ui";
import { Confirm, Submit } from "@/components/admin/Buttons";
import { ClassForm } from "@/components/admin/ClassForm";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/utils/time";
import type { ClassRow } from "@/types/db";
import { BatchScheduler } from "@/components/admin/BatchScheduler";
import { madridDateKey } from "@/lib/utils/time";
import { addSession, cancelSession, deleteClass, deleteSession, updateSessionCapacity } from "../actions";

export const metadata = { title: "Edit class" };
export const dynamic = "force-dynamic";

export default async function EditClass({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = await createClient();
  const { data: c } = await db.from("classes").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const cls = c as ClassRow;
  const { data: priv } = await db.from("class_private").select("online_url").eq("class_id", id).maybeSingle();
  const today = madridDateKey(new Date());
  const { data: sessions } = await db.from("class_sessions").select("id,starts_at,capacity,status,cancel_reason").eq("class_id", id).gte("starts_at", new Date(Date.now() - 864e5).toISOString()).order("starts_at").limit(300);
  const { data: held } = await db.from("bookings").select("session_id,participants").in("status", ["pending", "approved"]).in("session_id", (sessions ?? []).map((s) => s.id));
  const taken = new Map<string, number>();
  (held ?? []).forEach((b) => taken.set(b.session_id, (taken.get(b.session_id) ?? 0) + b.participants));
  return (
    <>
      <AdminTitle title={cls.title} sub={`/classes/${cls.slug}${cls.delivery === "online" ? " · Online class" : ""}`}><Badge s={cls.status} />
        <form action={deleteClass}><input type="hidden" name="id" value={id} /><Confirm message="Delete this class? If it has bookings it will be archived instead.">Delete</Confirm></form>
      </AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      <ClassForm c={cls} onlineUrl={priv?.online_url} />

      <h2 className="mb-4 mt-12 font-serif text-3xl text-deep">Schedule</h2>
      <p className="mb-4 text-sm text-ink-soft">Times are Mallorca local time (Europe/Madrid). Only sessions of <strong>published</strong> classes appear to visitors.</p>
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card title="Batch: whole week or month" className="lg:col-span-2">
          <p className="mb-4 text-sm text-ink-soft">Set a common timetable once — e.g. every Monday, Wednesday and Friday at 09:00 for the whole month — and all the sessions are created together.</p>
          <BatchScheduler classId={id} duration={cls.duration_minutes} capacity={cls.default_capacity} isDraft={cls.status !== "published"} today={today} />
        </Card>
        <Card title="Single session">
          <form action={addSession} className="space-y-4">
            <input type="hidden" name="class_id" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <TextIn label="Date" name="date" type="date" required /><TextIn label="Time" name="time" type="time" required />
              <TextIn label="Duration (min)" name="duration_minutes" type="number" defaultValue={cls.duration_minutes} /><TextIn label="Capacity" name="capacity" type="number" defaultValue={cls.default_capacity} />
            </div>
            <Submit>Add session</Submit>
          </form>
        </Card>
      </div>
      {!sessions?.length ? <Empty>No dates yet — this class can't be published until you add at least one.</Empty> : (
        <div className="overflow-x-auto border border-sage/60 bg-white">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-sage/60 bg-cream text-xs uppercase tracking-wider text-forest"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Seats held</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-sage/40">
              {sessions.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-4 py-3">{fmtDateTime(s.starts_at)}</td>
                  <td className="px-4 py-3"><Badge s={s.status} />{s.cancel_reason && <span className="ml-2 text-xs text-ink-soft">{s.cancel_reason}</span>}</td>
                  <td className="px-4 py-3">{taken.get(s.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <form action={updateSessionCapacity} className="flex gap-1"><input type="hidden" name="class_id" value={id} /><input type="hidden" name="session_id" value={s.id} />
                      <input name="capacity" type="number" defaultValue={s.capacity} aria-label="Capacity" className={`${aInput} !w-20`} /><button className="btn btn-outline btn-sm">Set</button></form>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {s.status === "scheduled" && (
                        <form action={cancelSession} className="flex gap-1"><input type="hidden" name="class_id" value={id} /><input type="hidden" name="session_id" value={s.id} />
                          <input name="reason" placeholder="Reason (emailed)" aria-label="Cancellation reason" className={`${aInput} !w-40`} /><Confirm message="Cancel this session? Pending and approved bookings will be cancelled and the visitors emailed.">Cancel session</Confirm></form>
                      )}
                      {(taken.get(s.id) ?? 0) === 0 && <form action={deleteSession}><input type="hidden" name="class_id" value={id} /><input type="hidden" name="session_id" value={s.id} /><Confirm message="Delete this session?">Delete</Confirm></form>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
