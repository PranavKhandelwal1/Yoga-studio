import Link from "next/link";
import { Search } from "lucide-react";
import { AdminTitle, Badge, Empty, Flash, Table, aInput } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime, madridLocalToUtc } from "@/lib/utils/time";
import { addDays } from "@/lib/utils/calendar";
import { decideBooking } from "./actions";

export const metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

type Row = { id: string; reference: string; full_name: string; email: string; participants: number; status: string; payment_status: string; total_price_cents: number | null; created_at: string; class_sessions: { starts_at: string; classes: { title: string } | null } };

export default async function Bookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = await createClient();
  let q = db.from("bookings").select("id,reference,full_name,email,participants,status,payment_status,total_price_cents,created_at,class_sessions!inner(starts_at,classes(title))").order("created_at", { ascending: false }).limit(200);
  if (sp.status && ["pending", "approved", "rejected", "cancelled"].includes(sp.status)) q = q.eq("status", sp.status);
  const term = (sp.q ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 80);
  if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,reference.ilike.%${term}%,phone.ilike.%${term}%`);
  if (sp.pay && ["paid", "unpaid", "refunded", "not_required"].includes(sp.pay)) q = q.eq("payment_status", sp.pay);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "")) q = q.gte("class_sessions.starts_at", madridLocalToUtc(sp.from!, "00:00").toISOString());
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "")) q = q.lt("class_sessions.starts_at", madridLocalToUtc(addDays(sp.to!, 1), "00:00").toISOString());
  const { data, error } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const ret = `/admin/bookings?${new URLSearchParams(Object.entries(sp).filter(([, v]) => v && !["ok", "err"].includes(String(v))) as [string, string][]).toString()}`;

  return (
    <>
      <AdminTitle title="Bookings" sub="Requests stay PENDING until you approve them." />
      <Flash ok={sp.ok} err={sp.err ?? error?.message} />
      <form className="mb-4 border border-sage/60 bg-white p-4" role="search" aria-label="Search bookings">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Search bookings</span>
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest" aria-hidden />
            <input type="search" name="q" defaultValue={sp.q} placeholder="Search by name, email, phone or reference" className={`${aInput} !min-h-12 !pl-10`} />
          </label>
          <button className="btn btn-primary shrink-0"><Search size={16} aria-hidden />Search</button>
        </div>
        <details className="mt-3" open={Boolean(sp.from || sp.to)}>
          <summary className="min-h-10 cursor-pointer text-sm text-forest underline-offset-4 hover:underline">Filter by class date</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label><span className="mb-1 block text-xs font-medium uppercase tracking-wider text-forest">From</span><input type="date" name="from" defaultValue={sp.from} className={aInput} /></label>
            <label><span className="mb-1 block text-xs font-medium uppercase tracking-wider text-forest">To</span><input type="date" name="to" defaultValue={sp.to} className={aInput} /></label>
            <label><span className="mb-1 block text-xs font-medium uppercase tracking-wider text-forest">Payment</span>
              <select name="pay" defaultValue={sp.pay ?? ""} className={aInput}><option value="">Any</option>{["paid", "unpaid", "refunded", "not_required"].map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
        </details>
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
      </form>
      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        {[["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["cancelled", "Cancelled"]].map(([v, l]) => {
          const params = new URLSearchParams(Object.entries(sp).filter(([k, x]) => x && !["ok", "err", "status"].includes(k)) as [string, string][]); if (v) params.set("status", v);
          const on = (sp.status ?? "") === v;
          return <Link key={v} href={`/admin/bookings?${params}`} aria-current={on ? "true" : undefined} className={`flex min-h-10 items-center border px-4 text-sm ${on ? "border-forest bg-forest text-cream" : "border-sage bg-white hover:bg-sage/20"}`}>{l}</Link>;
        })}
        {(sp.q || sp.from || sp.to || sp.pay) && <Link href="/admin/bookings" className="flex min-h-10 items-center px-3 text-sm underline underline-offset-4">Clear search</Link>}
        <span className="ml-auto flex items-center text-sm text-ink-soft">{rows.length} result{rows.length === 1 ? "" : "s"}</span>
      </nav>
      {rows.length === 0 ? <Empty>No bookings match.</Empty> : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((b) => (
              <li key={b.id} className="border border-sage/60 bg-white p-4">
                <div className="flex items-start justify-between gap-2"><Link href={`/admin/bookings/${b.id}`} className="font-medium underline-offset-4 hover:underline">{b.full_name}</Link><span className="flex gap-1"><Badge s={b.status} /><Badge s={b.payment_status} /></span></div>
                <p className="mt-1 text-sm text-ink-soft">{b.class_sessions.classes?.title} · {fmtDateTime(b.class_sessions.starts_at)} · {b.participants} {b.participants === 1 ? "person" : "people"}</p>
                {b.status === "pending" && !(b.payment_status === "unpaid" && (b.total_price_cents ?? 0) > 0) && <QuickActions id={b.id} returnTo={ret} />}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table head={["Guest", "Class", "When (Mallorca)", "People", "Status", "Payment", "Ref", ""]}>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/admin/bookings/${b.id}`} className="font-medium underline-offset-4 hover:underline">{b.full_name}</Link><br /><span className="text-xs text-ink-soft">{b.email}</span></td>
                  <td>{b.class_sessions.classes?.title}</td><td className="whitespace-nowrap">{fmtDateTime(b.class_sessions.starts_at)}</td><td>{b.participants}</td>
                  <td><Badge s={b.status} /></td><td><Badge s={b.payment_status} /></td><td className="font-mono text-xs">{b.reference}</td>
                  <td>{b.status === "pending" && !(b.payment_status === "unpaid" && (b.total_price_cents ?? 0) > 0) && <QuickActions id={b.id} returnTo={ret} />}</td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      )}
    </>
  );
}

function QuickActions({ id, returnTo }: { id: string; returnTo: string }) {
  return (
    <div className="mt-3 flex gap-2 md:mt-0">
      {(["approve", "reject"] as const).map((a) => (
        <form key={a} action={decideBooking}><input type="hidden" name="bookingId" value={id} /><input type="hidden" name="action" value={a} /><input type="hidden" name="returnTo" value={returnTo} />
          <Submit variant={a === "approve" ? "primary" : "outline"} small pendingText="…">{a === "approve" ? "Approve" : "Reject"}</Submit></form>
      ))}
    </div>
  );
}
