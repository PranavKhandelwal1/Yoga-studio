import { notFound } from "next/navigation";
import { AdminTitle, AreaIn, Card, Check, Flash, TextIn } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";
import { ImageField } from "@/components/admin/ImageField";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { PAGE_SCHEMAS } from "@/lib/content/schema";
import { getPage, isOn } from "@/lib/content/get";
import { createClient } from "@/lib/supabase/server";
import { saveContent } from "../actions";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return { title: PAGE_SCHEMAS[slug]?.label ?? "Content" }; }

export default async function EditContent({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const schema = PAGE_SCHEMAS[slug];
  if (!schema) notFound();
  // Read as the signed-in admin so unsaved defaults and saved values are both shown.
  const db = await createClient();
  const { data } = await db.from("pages").select("content,seo_title,seo_description,og_image_url").eq("slug", slug).maybeSingle();
  const page = await getPage(slug);
  const c = { ...page.content, ...((data?.content as Record<string, string>) ?? {}) };
  const folder = slug === "about" ? "portraits" : "homepage";
  return (
    <>
      <AdminTitle title={schema.label} sub={`Public page: ${schema.path}`} />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveContent} className="space-y-6">
        <input type="hidden" name="slug" value={slug} />
        {schema.sections.map((s) => (
          <Card key={s.id} title={s.label}>
            <div className="grid gap-4 md:grid-cols-2">
              {s.fields.map((f) => {
                if (f.type === "toggle") return <Check key={f.key} label={f.label} name={f.key} defaultChecked={isOn(c, f.key)} />;
                if (f.type === "image") return <div key={f.key} className="md:col-span-2"><ImageField name={f.key} altName={`${f.key}_alt`} label={f.label} folder={folder} defaultValue={c[f.key]} altDefault={c[`${f.key}_alt`]} /></div>;
                if (f.type === "markdown") return <div key={f.key} className="md:col-span-2"><MarkdownEditor name={f.key} label={f.label} defaultValue={c[f.key]} /></div>;
                if (f.type === "textarea") return <AreaIn key={f.key} className="md:col-span-2" label={f.label} name={f.key} rows={4} defaultValue={c[f.key]} hint={f.help} />;
                return <TextIn key={f.key} label={f.label} name={f.key} defaultValue={c[f.key]} hint={f.help} />;
              })}
            </div>
          </Card>
        ))}
        <Card title="SEO & social sharing">
          <div className="grid gap-4 md:grid-cols-2">
            <TextIn label="SEO title" name="seo_title" defaultValue={data?.seo_title ?? page.seo_title} hint="≈ 60 characters" />
            <TextIn label="SEO description" name="seo_description" defaultValue={data?.seo_description ?? page.seo_description} hint="≈ 155 characters" />
            <TextIn label="Social sharing image URL" name="og_image_url" defaultValue={data?.og_image_url} className="md:col-span-2" hint="Leave blank to use the default." />
          </div>
        </Card>
        <Submit>Save changes</Submit>
      </form>
    </>
  );
}
