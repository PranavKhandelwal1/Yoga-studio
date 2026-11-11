import { AreaIn, Card, SelectIn, TextIn } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";
import { ImageField } from "@/components/admin/ImageField";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { fmtTime, madridDateKey } from "@/lib/utils/time";
import type { BlogCategory, BlogPost } from "@/types/db";
import { savePost } from "@/app/admin/(panel)/blog/actions";

export function PostForm({ p, categories }: { p?: Partial<BlogPost>; categories: BlogCategory[] }) {
  const local = p?.published_at ? `${madridDateKey(p.published_at)}T${fmtTime(p.published_at)}` : "";
  return (
    <form action={savePost} className="space-y-6">
      {p?.id && <input type="hidden" name="id" value={p.id} />}
      <Card title="Article">
        <div className="grid gap-4 md:grid-cols-2">
          <TextIn label="Title" name="title" defaultValue={p?.title} required className="md:col-span-2" />
          <TextIn label="URL slug" name="slug" defaultValue={p?.slug} hint="Blank = from title. Changing it changes the public URL." />
          <SelectIn label="Category" name="category_id" defaultValue={p?.category_id ?? ""} options={[["", "— None —"], ...categories.map((c): [string, string] => [c.id, c.name])]} />
          <AreaIn className="md:col-span-2" label="Excerpt" name="excerpt" rows={2} defaultValue={p?.excerpt} />
          <div className="md:col-span-2"><MarkdownEditor name="body" label="Body" defaultValue={p?.body} rows={20} /></div>
          <TextIn label="Author" name="author_name" defaultValue={p?.author_name ?? "Angela"} />
        </div>
      </Card>
      <Card title="Publishing">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectIn label="Status" name="status" defaultValue={p?.status ?? "draft"} options={[["draft", "Draft (hidden)"], ["published", "Published"]]} />
          <TextIn label="Publish date & time (Mallorca time)" name="published_at" type="datetime-local" defaultValue={local} hint="Published + a future date = scheduled. Blank = publish now." />
        </div>
      </Card>
      <Card title="Image & SEO">
        <div className="space-y-4">
          <ImageField name="featured_image_url" altName="featured_image_alt" label="Featured image" folder="blog" defaultValue={p?.featured_image_url} altDefault={p?.featured_image_alt} />
          <div className="grid gap-4 md:grid-cols-2"><TextIn label="SEO title" name="seo_title" defaultValue={p?.seo_title} /><TextIn label="SEO description" name="seo_description" defaultValue={p?.seo_description} /></div>
        </div>
      </Card>
      <Submit>Save article</Submit>
    </form>
  );
}
