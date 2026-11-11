import { AdminTitle, Card, Empty, Flash, TextIn } from "@/components/admin/ui";
import { Confirm, Submit } from "@/components/admin/Buttons";
import { createClient } from "@/lib/supabase/server";
import { deleteCategory, saveCategory } from "../actions";
export const metadata = { title: "Categories" };
export const dynamic = "force-dynamic";
export default async function Categories({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { data } = await (await createClient()).from("blog_categories").select("*").order("name");
  return (
    <>
      <AdminTitle title="Journal categories" />
      <Flash ok={sp.ok} err={sp.err} />
      <Card title="Add category" className="mb-6"><form action={saveCategory} className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end"><TextIn label="Name" name="name" required /><TextIn label="Slug" name="slug" hint="Optional" /><TextIn label="Description" name="description" /><Submit>Add</Submit></form></Card>
      {!data?.length ? <Empty>No categories.</Empty> : <div className="space-y-3">{data.map((c) => (
        <Card key={c.id}><form action={saveCategory} className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end"><input type="hidden" name="id" value={c.id} /><TextIn label="Name" name="name" defaultValue={c.name} required /><TextIn label="Slug" name="slug" defaultValue={c.slug} /><TextIn label="Description" name="description" defaultValue={c.description} /><Submit small>Save</Submit></form>
          <form action={deleteCategory} className="mt-2"><input type="hidden" name="id" value={c.id} /><Confirm message="Delete this category? Its articles become uncategorised.">Delete</Confirm></form></Card>))}</div>}
    </>
  );
}
