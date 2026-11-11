import Link from "next/link";
import { AdminTitle, Badge, Empty, Flash, Table, aInput } from "@/components/admin/ui";
import { Confirm } from "@/components/admin/Buttons";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/utils/time";
import { removeSubscriber, setSubscriberStatus } from "./actions";
export const metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";

export default async function Newsletter({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = await createClient();
  let q = db.from("newsletter_subscribers").select("id,email,status,source,subscribed_at", { count: "exact" }).order("subscribed_at", { ascending: false }).limit(300);
  const term = (sp.q ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 80);
  if (term) q = q.ilike("email", `%${term}%`);
  if (sp.status === "subscribed" || sp.status === "unsubscribed") q = q.eq("status", sp.status);
  const [{ data, count }, { count: active }] = await Promise.all([q, db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "subscribed")]);
  return (
    <>
      <AdminTitle title="Newsletter" sub={`${active ?? 0} active subscribers`}>
        <Link href={`/admin/newsletter/export${sp.status ? `?status=${sp.status}` : ""}`} prefetch={false} className="btn btn-primary btn-sm">Export CSV</Link>
      </AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      <form role="search" className="mb-6 flex flex-wrap gap-3 border border-sage/60 bg-white p-4">
        <input name="q" defaultValue={sp.q} placeholder="Search email" aria-label="Search email" className={`${aInput} !w-64`} />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={`${aInput} !w-44`}><option value="">All statuses</option><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option></select>
        <button className="btn btn-primary btn-sm">Filter</button>
      </form>
      {!data?.length ? <Empty>No subscribers match.</Empty> : (
        <Table head={["Email", "Status", "Source", "Subscribed", "Actions"]}>
          {data.map((s) => (
            <tr key={s.id}><td>{s.email}</td><td><Badge s={s.status} /></td><td>{s.source ?? "—"}</td><td>{fmtDate(s.subscribed_at, { weekday: undefined })}</td>
              <td><div className="flex gap-2">
                <form action={setSubscriberStatus}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value={s.status === "subscribed" ? "unsubscribed" : "subscribed"} /><button className="btn btn-outline btn-sm">{s.status === "subscribed" ? "Mark unsubscribed" : "Resubscribe"}</button></form>
                <form action={removeSubscriber}><input type="hidden" name="id" value={s.id} /><Confirm message={`Remove ${s.email}?`}>Remove</Confirm></form></div></td></tr>
          ))}
        </Table>
      )}
      {(count ?? 0) > 300 && <p className="mt-3 text-sm text-ink-soft">Showing the latest 300 of {count}. Use search or export the full list.</p>}
    </>
  );
}
