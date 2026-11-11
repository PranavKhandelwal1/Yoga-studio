import { notFound } from "next/navigation";
import { AdminTitle, Badge, Card, Empty, Flash, SelectIn, aInput } from "@/components/admin/ui";
import { Confirm, Submit } from "@/components/admin/Buttons";
import { RetreatForm } from "@/components/admin/RetreatForm";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/utils/time";
import type { RetreatRow } from "@/types/db";
import { deleteEnquiry, deleteRetreat, refundDeposit, updateEnquiry } from "../actions";

export const metadata = { title: "Edit retreat" };
export const dynamic = "force-dynamic";

export default async function EditRetreat({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = await createClient();
  const { data: r } = await db.from("retreats").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: enq } = await db.from("retreat_enquiries").select("*").eq("retreat_id", id).order("created_at", { ascending: false });
  const ret = r as RetreatRow;
  return (
    <>
      <AdminTitle title={ret.title} sub={`/retreats/${ret.slug}`}><Badge s={ret.status} />
        <form action={deleteRetreat}><input type="hidden" name="id" value={id} /><Confirm message="Delete this retreat and all its enquiries? Consider archiving instead.">Delete</Confirm></form>
      </AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      <RetreatForm r={ret} />
      <h2 className="mb-4 mt-12 font-serif text-3xl text-deep">Enquiries ({enq?.length ?? 0})</h2>
      {!enq?.length ? <Empty>No enquiries yet.</Empty> : (
        <div className="space-y-4">
          {enq.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-medium text-deep">{e.full_name} <span className="font-normal text-ink-soft">· {e.participants} {e.participants === 1 ? "person" : "people"}</span></p>
                  <p className="text-sm"><a className="text-forest underline" href={`mailto:${e.email}`}>{e.email}</a>{e.phone && <> · {e.phone}</>}</p>
                  <p className="text-xs text-ink-soft">{fmtDateTime(e.created_at)} · {e.kind === "booking_request" ? "Booking request" : "Enquiry"} · Ref {e.reference}</p></div>
                <div className="flex flex-wrap gap-2"><Badge s={e.status} />{e.payment_status !== "not_required" && <Badge s={e.payment_status} />}</div>
              </div>
              {e.deposit_cents != null && e.payment_status !== "not_required" && <p className="mt-2 text-sm">Deposit: <strong>{(e.deposit_cents / 100).toFixed(2)} {ret.currency}</strong>{e.payment_status === "paid" && <> · paid via {e.payment_provider === "paypal" ? "PayPal" : "card"}</>}{e.payment_status === "unpaid" && " · awaiting payment (no places held yet)"}</p>}
              {e.payment_status === "paid" && <form action={refundDeposit} className="mt-2"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="retreat_id" value={id} /><Confirm message="Refund this deposit in full and release the places?">Refund deposit &amp; release places</Confirm></form>}
              {e.message && <p className="mt-3 whitespace-pre-wrap border-l-2 border-sage pl-3 text-sm">{e.message}</p>}
              <form action={updateEnquiry} className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={e.id} /><input type="hidden" name="retreat_id" value={id} />
                <SelectIn label="Status" name={`status`} defaultValue={e.status} options={[["new", "New"], ["contacted", "Contacted"], ["confirmed", "Confirmed"], ["closed", "Closed"]]} />
                <div><label className="mb-1 block text-sm font-medium text-deep">Internal notes</label><input name="admin_notes" defaultValue={e.admin_notes ?? ""} className={aInput} /></div>
                <Submit small>Save</Submit>
              </form>
              <form action={deleteEnquiry} className="mt-2"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="retreat_id" value={id} /><Confirm message="Delete this enquiry?">Delete enquiry</Confirm></form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
