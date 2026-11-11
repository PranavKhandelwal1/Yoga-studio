import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Facebook, Instagram, Twitter, Youtube } from "@/components/ui/SocialIcons";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContactForm } from "@/components/ui/ContactForm";
import { getSettings } from "@/lib/content/get";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildMetadata({ title: "Contact", description: "Contact Angela — questions about yoga classes, private sessions and retreats in Mallorca.", path: "/contact" });

export default async function ContactPage() {
  const { contact: c, social: so } = await getSettings();
  const socials = [[so.instagram, "Instagram", Instagram], [so.facebook, "Facebook", Facebook], [so.twitter, "X / Twitter", Twitter], [so.youtube, "YouTube", Youtube]] as const;
  return (
    <>
      <PageHeader eyebrow="Contact" title="Get in touch" subtitle="Questions about classes, private sessions or retreats? Send a message or reach out directly." />
      <section className="section"><div className="container-x grid gap-14 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-7"><h2 className="h-sub mb-6">Send a message</h2><ContactForm /></div>
        <aside className="lg:col-span-5">
          <h2 className="h-sub mb-6">Details</h2>
          <ul className="space-y-4">
            {c.email && <li className="flex gap-3"><Mail size={20} className="mt-1 shrink-0 text-forest" /><a href={`mailto:${c.email}`} className="underline underline-offset-4">{c.email}</a></li>}
            {c.phone && <li className="flex gap-3"><Phone size={20} className="mt-1 shrink-0 text-forest" /><a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="underline underline-offset-4">{c.phone}</a></li>}
            {c.whatsapp && <li className="flex gap-3"><MessageCircle size={20} className="mt-1 shrink-0 text-forest" /><a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Message on WhatsApp</a></li>}
            {(c.studio_name || c.studio_address) && <li className="flex gap-3"><MapPin size={20} className="mt-1 shrink-0 text-forest" /><address className="not-italic">{c.studio_name && <strong className="font-medium">{c.studio_name}<br /></strong>}{c.studio_address}</address></li>}
          </ul>
          <ul className="mt-6 flex flex-wrap gap-3">
            {socials.filter(([h]) => h).map(([h, l, Icon]) => <li key={l}><a href={h!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 border border-sage px-4 text-sm hover:bg-sage/30"><Icon size={16} />{l}</a></li>)}
          </ul>
        </aside>
      </div></section>
    </>
  );
}
