import { AdminTitle, Badge, Card, Empty, Flash, SelectIn, TextIn } from "@/components/admin/ui";
import { Confirm, Submit } from "@/components/admin/Buttons";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ALT } from "@/lib/content/constants";
import { deleteGalleryImage, saveGalleryImage } from "./actions";
export const metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

export default async function Gallery({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { data } = await (await createClient()).from("gallery_images").select("*").order("status").order("sort_order").order("created_at", { ascending: false });
  return (
    <>
      <AdminTitle title="Gallery" sub="Photos are resized, converted to WebP and published as soon as you upload them. Each keeps its own proportions on the site."><GalleryUploader categories={Array.from(new Set((data ?? []).map((g) => g.category)))} /></AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      {!data?.length ? <Empty>No images yet.</Empty> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.map((g) => (
            <Card key={g.id}>
              <div className="flex gap-3 sm:gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="flex h-36 w-28 shrink-0 items-start sm:w-40"><img src={g.url} alt={g.alt} className="max-h-36 w-full bg-sage/20 object-contain" loading="lazy" /></div>
                <form action={saveGalleryImage} className="grid min-w-0 flex-1 gap-2">
                  <input type="hidden" name="id" value={g.id} />
                  <TextIn label="Description (alt text)" name="alt" defaultValue={g.alt} required hint={g.alt === DEFAULT_ALT ? "Please describe what the photo shows." : undefined} />
                  <div className="grid grid-cols-2 gap-2"><TextIn label="Category" name="category" defaultValue={g.category} /><TextIn label="Order" name="sort_order" type="number" defaultValue={g.sort_order} /></div>
                  <TextIn label="Caption" name="caption" defaultValue={g.caption} />
                  <SelectIn label="Status" name="status" defaultValue={g.status} options={[["published", "Published"], ["draft", "Draft"]]} />
                  <div className="flex items-center gap-2"><Submit small>Save</Submit><Badge s={g.status} /></div>
                </form>
              </div>
              <form action={deleteGalleryImage} className="mt-3"><input type="hidden" name="id" value={g.id} /><Confirm message="Delete this image?">Delete</Confirm></form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
