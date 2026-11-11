import { PageHeader } from "@/components/ui/PageHeader";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { getGallery } from "@/lib/data/queries";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildMetadata({ title: "Gallery", description: "Photographs of yoga classes, retreats and life on the mat with Angela in Mallorca.", path: "/gallery" });

export default async function GalleryPage() {
  const items = await getGallery();
  return (
    <>
      <PageHeader eyebrow="Gallery" title="Moments from the mat" />
      <section className="section"><div className="container-x"><GalleryGrid items={items} /></div></section>
    </>
  );
}
