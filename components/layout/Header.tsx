"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { Lotus } from "@/components/ui/YogaIcons";
import { AnimatePresence, motion } from "framer-motion";
import { btn } from "@/components/ui/Button";

const NAV = [
  { href: "/classes", label: "Classes" },
  { href: "/schedule", label: "Schedule" },
  { href: "/retreats", label: "Retreats" },
  { href: "/about", label: "About" },
  { href: "/journal", label: "Journal" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export function Header({ siteName }: { siteName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", esc); };
  }, [open]);

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  // On the home page the header starts as part of the dark espresso hero, then turns to light paper once you scroll.
  const clear = pathname === "/" && !scrolled && !open;

  return (
    <>
    <header className={`sticky top-0 z-40 transition-[background-color,color,border-color] duration-500 ${clear ? "border-b border-transparent bg-deep text-cream" : "border-b border-line bg-cream/90 text-charcoal backdrop-blur-md"}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-forest focus:px-4 focus:py-2 focus:text-cream">Skip to content</a>
      <div className="container-x flex h-[4.5rem] items-center gap-3 sm:gap-5 lg:h-24 lg:gap-10">
        <Link href="/" className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap font-serif text-[1.2rem] font-light min-[360px]:text-[1.3rem] sm:text-[1.7rem] leading-none tracking-tight transition-colors ${clear ? "text-cream" : "text-deep"}`} aria-label={`${siteName} — home`}><Lotus size={26} className="mr-2.5 hidden text-gold sm:block" />{siteName}</Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-9 xl:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={`relative py-2 text-[0.9375rem] transition-opacity after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:bg-current after:transition-transform after:duration-500 ${active(n.href) ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"}`}>{n.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-4">
            <Link href="/book/lookup" aria-label="Find my booking" title="Find my booking" className="hidden h-10 w-10 items-center xl:flex justify-center opacity-80 transition-opacity hover:opacity-100"><Search size={18} strokeWidth={1.5} /></Link>
          <Link href="/book" className={`btn btn-sm whitespace-nowrap !px-2.5 sm:!px-5 ${clear ? "btn-gold" : "btn-primary"}`}>Book a class</Link>
        <button type="button" className="-mr-2 flex h-11 w-11 items-center justify-center xl:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={26} strokeWidth={1.5} /> : <Menu size={26} strokeWidth={1.5} />}
        </button>
        </div>
      </div>
    </header>
      <AnimatePresence>
        {open && (
          <motion.nav id="mobile-menu" aria-label="Mobile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            className="fixed inset-x-0 top-[4.5rem] bottom-0 z-30 lg:top-24 overflow-y-auto bg-cream px-6 pb-10 pt-6 text-charcoal xl:hidden">
            <ul>
              {NAV.map((n) => (
                <li key={n.href}><Link href={n.href} className="block border-b border-line py-4 font-serif text-[2rem] font-light text-deep" aria-current={active(n.href) ? "page" : undefined}>{n.label}</Link></li>
              ))}
            </ul>
            <Link href="/book" className={`${btn("primary")} mt-10 w-full`}>Book a class</Link>
            <Link href="/book/lookup" className={`${btn("outline")} mt-3 w-full`}><Search size={16} />Find my booking</Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
