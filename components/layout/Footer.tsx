import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Lotus, LotusDivider } from "@/components/ui/YogaIcons";
import { Facebook, Instagram, Twitter, Youtube } from "@/components/ui/SocialIcons";
import type { Settings } from "@/types/db";
import { NewsletterForm } from "@/components/ui/NewsletterForm";

export function Footer({ s }: { s: Settings }) {
  const { contact: c, social: so, general: g } = s;
  const socials = [
    { href: so.instagram, label: "Instagram", Icon: Instagram }, { href: so.facebook, label: "Facebook", Icon: Facebook },
    { href: so.twitter, label: "X / Twitter", Icon: Twitter }, { href: so.youtube, label: "YouTube", Icon: Youtube },
  ].filter((x) => x.href);
  const mapSrc = c.map_query ? `https://www.google.com/maps?q=${encodeURIComponent(c.map_query)}&z=15&output=embed` : null;
  return (
    <footer className="bg-deep text-cream">
      {mapSrc && (
        <section aria-label="Find us on the map">
          <iframe title={`Map: ${c.studio_name || c.location || "Studio location"}`} src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-72 w-full border-0 grayscale-[.7] transition-[filter] duration-700 hover:grayscale-0 md:h-96" />
          <div className="border-b border-cream/10 bg-deep px-5 py-4 text-center text-sm text-cream/85">
            {c.studio_name && <strong className="font-medium">{c.studio_name}</strong>}{c.studio_address && <> · {c.studio_address}</>} ·{" "}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.map_query)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white">Get directions</a>
          </div>
        </section>
      )}
      <div className="container-x grid gap-14 py-20 md:grid-cols-12 lg:py-28">
        <div className="md:col-span-5">
          <Lotus size={38} className="mb-5 text-gold" />
          <p className="font-serif text-5xl font-light text-cream">{g.site_name}</p>
          <p className="mt-3 max-w-sm text-cream/75">{g.tagline}</p>
          <div className="mt-8 max-w-sm"><p className="mb-3 text-sm text-cream/70">Occasional letters from Angela</p><NewsletterForm tone="dark" source="footer" /></div>
        </div>
        <nav aria-label="Footer" className="md:col-span-3">
          <p className="mb-3 font-serif text-xl italic text-sage">Explore</p>
          <ul>
            {[["/classes", "Classes"], ["/schedule", "Schedule"], ["/book", "Book a class"], ["/book/lookup", "Find my booking"], ["/private", "Private sessions"], ["/retreats", "Retreats"], ["/about", "About Angela"], ["/journal", "Journal"], ["/gallery", "Gallery"], ["/contact", "Contact"]].map(([h, l]) => (
              <li key={h}><Link href={h} className="flex min-h-11 items-center text-cream/85 transition-colors hover:text-white">{l}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-4">
          <p className="mb-3 font-serif text-xl italic text-sage">Contact</p>
          <ul className="space-y-1 text-cream/85">
            {c.email && <li className="flex gap-3"><Mail size={18} className="mt-1 shrink-0" /><a href={`mailto:${c.email}`} className="inline-flex min-h-11 items-center hover:text-white">{c.email}</a></li>}
            {c.phone && <li className="flex gap-3"><Phone size={18} className="mt-1 shrink-0" /><a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="inline-flex min-h-11 items-center hover:text-white">{c.phone}</a></li>}
            {c.whatsapp && <li className="flex gap-3"><MessageCircle size={18} className="mt-1 shrink-0" /><a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:text-white">WhatsApp</a></li>}
            {(c.studio_name || c.location) && <li className="flex gap-3"><MapPin size={18} className="mt-1 shrink-0" /><span>{c.studio_name && <>{c.studio_name}<br /></>}{c.location}</span></li>}
          </ul>
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-4">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-11 w-11 items-center justify-center border border-cream/30 transition-colors hover:bg-cream hover:text-deep"><Icon size={18} /></a></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <LotusDivider className="pb-8" />
      <div className="border-t border-cream/15">
        <div className="container-x flex flex-col gap-2 py-6 text-sm text-cream/65 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {g.site_name}. All rights reserved.</p>
          <p><Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-white">Privacy policy</Link></p>
        </div>
      </div>
    </footer>
  );
}
