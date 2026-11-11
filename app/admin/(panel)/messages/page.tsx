import { AdminTitle, Badge, Card, Unread, Empty, Flash } from "@/components/admin/ui";
import { Confirm } from "@/components/admin/Buttons";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/utils/time";
import { deleteMessage, setMessageStatus } from "./actions";
export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function Messages({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; status?: string }> }) {
  const sp = await searchParams;
  let q = (await createClient()).from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
  if (sp.status && ["new", "read", "replied", "archived"].includes(sp.status)) q = q.eq("status", sp.status);
  const { data } = await q;
  return (
    <>
      <AdminTitle title="Messages" sub="Messages from the contact form. Retreat enquiries are under Retreats." />
      <Flash ok={sp.ok} err={sp.err} />
      {!data?.length ? <Empty>No messages.</Empty> : (
        <div className="space-y-4">
          {data.map((m) => (
            <Card key={m.id} className={m.status === "new" ? "border-l-4 border-l-[#c0392b]" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-medium text-deep">{m.name}{m.subject && <span className="font-normal text-ink-soft"> — {m.subject}</span>}</p>
                  <p className="text-sm"><a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? "your message"}`)}`} className="text-forest underline">{m.email}</a>{m.phone && <> · {m.phone}</>}</p>
                  <p className="text-xs text-ink-soft">{fmtDateTime(m.created_at)}</p></div>
                {m.status === "new" ? <Unread /> : <Badge s={m.status} />}
              </div>
              <p className="mt-3 whitespace-pre-wrap border-l-2 border-sage pl-3 text-sm">{m.message}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["read", "replied", "archived", "new"] as const).filter((s) => s !== m.status).map((s) => (
                  <form key={s} action={setMessageStatus}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={s} /><button className="btn btn-outline btn-sm">Mark {s}</button></form>))}
                <form action={deleteMessage}><input type="hidden" name="id" value={m.id} /><Confirm message="Delete this message?">Delete</Confirm></form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
