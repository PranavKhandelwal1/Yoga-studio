import Link from "next/link";
import { AdminTitle, Card } from "@/components/admin/ui";
import { PAGE_SCHEMAS } from "@/lib/content/schema";
export const metadata = { title: "Content" };
export default function Content() {
  return (
    <>
      <AdminTitle title="Content" sub="Edit the text, images and SEO of every page. Changes go live immediately." />
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(PAGE_SCHEMAS).map(([slug, p]) => (
          <Link key={slug} href={`/admin/content/${slug}`} className="block"><Card className="h-full transition-colors hover:border-forest"><h2 className="font-serif text-2xl text-deep">{p.label}</h2><p className="mt-1 text-sm text-ink-soft">{p.sections.length} section{p.sections.length > 1 ? "s" : ""} · {p.path}</p></Card></Link>
        ))}
        <Link href="/admin/gallery"><Card className="h-full hover:border-forest"><h2 className="font-serif text-2xl text-deep">Gallery</h2><p className="mt-1 text-sm text-ink-soft">Upload and organise photographs</p></Card></Link>
        <Link href="/admin/testimonials"><Card className="h-full hover:border-forest"><h2 className="font-serif text-2xl text-deep">Testimonials</h2><p className="mt-1 text-sm text-ink-soft">Quotes from students</p></Card></Link>
        <Link href="/admin/settings"><Card className="h-full hover:border-forest"><h2 className="font-serif text-2xl text-deep">Contact & social</h2><p className="mt-1 text-sm text-ink-soft">Email, phone, WhatsApp, address, social links</p></Card></Link>
      </div>
    </>
  );
}
