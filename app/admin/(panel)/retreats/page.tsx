import Link from "next/link";
import { AdminTitle, Badge, Empty, Flash, LinkBtn, Table } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils/format";
export const metadata = { title: "Retreats" };
export const dynamic = "force-dynamic";

export default async function Retreats({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const db = await createClient();
  const [{ data: retreats }, { data: enq }] = await Promise.all([
    db.from("retreats").select("id,title,status,start_date,end_date,price_cents,currency,capacity,places_taken").order("start_date", { ascending: false, nullsFirst: true }),
    db.from("retreat_enquiries").select("retreat_id").eq("status", "new"),
  ]);
  const newCount = new Map<string, number>();
  (enq ?? []).forEach((e) => newCount.set(e.retreat_id, (newCount.get(e.retreat_id) ?? 0) + 1));
  return (
    <>
      <AdminTitle title="Retreats" sub="Retreats and their enquiries."><LinkBtn href="/admin/retreats/new">New retreat</LinkBtn></AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      {!retreats?.length ? <Empty>No retreats yet. The homepage shows a “coming soon” message until you publish one.</Empty> : (
        <Table head={["Retreat", "Status", "Dates", "Price", "Places", "New enquiries"]}>
          {retreats.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/admin/retreats/${r.id}`} className="font-medium text-forest underline">{r.title}</Link></td><td><Badge s={r.status} /></td>
              <td>{r.start_date ?? "—"}{r.end_date ? ` → ${r.end_date}` : ""}</td><td>{formatPrice(r.price_cents, r.currency)}</td>
              <td>{r.capacity != null ? `${r.places_taken}/${r.capacity}` : "—"}</td><td>{newCount.get(r.id) ?? 0}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
