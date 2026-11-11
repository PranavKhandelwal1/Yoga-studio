import { AdminTitle, AreaIn, Badge, Card, Flash, SelectIn, TextIn } from "@/components/admin/ui";
import { Confirm, Submit } from "@/components/admin/Buttons";
import { createClient } from "@/lib/supabase/server";
import { deleteTestimonial, saveTestimonial } from "./actions";
export const metadata = { title: "Testimonials" };
export const dynamic = "force-dynamic";

function Form({ t }: { t?: { id: string; author_name: string; author_detail: string | null; quote: string; sort_order: number; status: string } }) {
  return (
    <form action={saveTestimonial} className="grid gap-3 md:grid-cols-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <TextIn label="Name" name="author_name" defaultValue={t?.author_name} required /><TextIn label="Detail (e.g. location)" name="author_detail" defaultValue={t?.author_detail} />
      <AreaIn className="md:col-span-2" label="Quote" name="quote" rows={3} defaultValue={t?.quote} />
      <TextIn label="Sort order" name="sort_order" type="number" defaultValue={t?.sort_order ?? 0} />
      <SelectIn label="Status" name="status" defaultValue={t?.status ?? "draft"} options={[["draft", "Draft"], ["published", "Published"]]} />
      <div className="flex gap-2 md:col-span-2"><Submit>{t ? "Save" : "Add testimonial"}</Submit></div>
    </form>
  );
}
export default async function Testimonials({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { data } = await (await createClient()).from("testimonials").select("*").order("sort_order").order("created_at");
  return (
    <>
      <AdminTitle title="Testimonials" sub="Only add real quotes with the student's permission. Published ones appear on the homepage." />
      <Flash ok={sp.ok} err={sp.err} />
      <Card title="Add a testimonial" className="mb-8"><Form /></Card>
      <div className="space-y-4">
        {data?.map((t) => (
          <Card key={t.id}><div className="mb-3"><Badge s={t.status} /></div><Form t={t} />
            <form action={deleteTestimonial} className="mt-2"><input type="hidden" name="id" value={t.id} /><Confirm message="Delete this testimonial?">Delete</Confirm></form></Card>
        ))}
      </div>
    </>
  );
}
