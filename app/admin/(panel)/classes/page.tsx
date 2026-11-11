import Link from "next/link";
import { AdminTitle, Badge, Empty, Flash, LinkBtn, Table } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils/format";
export const metadata = { title: "Classes" };
export const dynamic = "force-dynamic";

export default async function Classes({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const db = await createClient();
  const [{ data: classes }, { data: upcoming }] = await Promise.all([
    db.from("classes").select("id,title,slug,status,price_cents,currency,duration_minutes,default_capacity").order("sort_order").order("title"),
    db.from("class_sessions").select("class_id").eq("status", "scheduled").gte("starts_at", new Date().toISOString()),
  ]);
  const counts = new Map<string, number>();
  (upcoming ?? []).forEach((s) => counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1));
  return (
    <>
      <AdminTitle title="Classes" sub="Create classes, then schedule sessions for them."><LinkBtn href="/admin/classes/new">New class</LinkBtn></AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      {!classes?.length ? <Empty>No classes yet.</Empty> : (
        <Table head={["Class", "Status", "Price", "Duration", "Capacity", "Upcoming sessions"]}>
          {classes.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/admin/classes/${c.id}`} className="font-medium text-forest underline">{c.title}</Link></td>
              <td><Badge s={c.status} /></td><td>{formatPrice(c.price_cents, c.currency)}</td><td>{c.duration_minutes} min</td><td>{c.default_capacity}</td><td>{counts.get(c.id) ?? 0}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
