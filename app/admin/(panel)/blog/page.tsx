import Link from "next/link";
import { AdminTitle, Badge, Empty, Flash, LinkBtn, Table } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/utils/time";
export const metadata = { title: "Journal" };
export const dynamic = "force-dynamic";

export default async function Blog({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { data } = await (await createClient()).from("blog_posts").select("id,title,slug,status,published_at,blog_categories(name)").order("created_at", { ascending: false }).limit(300);
  const now = Date.now();
  return (
    <>
      <AdminTitle title="Journal" sub="Articles, drafts and scheduled posts."><LinkBtn href="/admin/blog/categories" variant="outline">Categories</LinkBtn><LinkBtn href="/admin/blog/new">New article</LinkBtn></AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      {!data?.length ? <Empty>No articles yet.</Empty> : (
        <Table head={["Title", "Status", "Category", "Date"]}>
          {data.map((p) => {
            const scheduled = p.status === "published" && p.published_at && new Date(p.published_at).getTime() > now;
            const cat = (p.blog_categories as unknown as { name: string } | null)?.name;
            return (<tr key={p.id}><td><Link href={`/admin/blog/${p.id}`} className="font-medium text-forest underline">{p.title}</Link></td><td><Badge s={scheduled ? "scheduled" : p.status} /></td><td>{cat ?? "—"}</td><td>{p.published_at ? fmtDate(p.published_at, { weekday: undefined }) : "—"}</td></tr>);
          })}
        </Table>
      )}
    </>
  );
}
