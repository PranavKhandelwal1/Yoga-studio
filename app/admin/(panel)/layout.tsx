import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileText, Image as ImageIcon, LayoutDashboard, LogOut, Mail, MessageSquare, Mountain, Newspaper, Quote, Settings, Ticket } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logout } from "../actions";
import { AdminBackLink } from "@/components/ui/BackButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { getSettings } from "@/lib/content/get";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const items = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/admin/bookings", label: "Bookings", icon: Ticket },
  { href: "/admin/classes", label: "Classes", icon: CalendarDays }, { href: "/admin/retreats", label: "Retreats", icon: Mountain },
  { href: "/admin/content", label: "Content", icon: FileText }, { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/admin/blog", label: "Journal", icon: Newspaper }, { href: "/admin/testimonials", label: "Testimonials", icon: Quote },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail }, { href: "/admin/messages", label: "Messages", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin(); // server-side gate on EVERY admin page render
  const siteName = (await getSettings()).general.site_name;
  const { count: unread } = await (await createClient()).from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new");
  return (
    <div className="min-h-screen bg-[#f1ecef] lg:grid lg:grid-cols-[15rem_1fr]">
      {/* On desktop the sidebar is a fixed-height column: brand on top, menu in the middle (scrolls when the window is short), account links pinned at the bottom — nothing can overlap. */}
      <aside className="border-b border-sage/60 bg-deep text-cream lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-0">
        <div className="flex shrink-0 items-center justify-between px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Link href="/admin/dashboard" className="font-serif text-2xl text-cream">{siteName}<span className="block text-xs font-sans uppercase tracking-[0.2em] text-sage">Admin</span></Link>
          <div className="flex items-center lg:hidden">
            <Link href="/" target="_blank" className="flex min-h-11 items-center px-3 text-sm hover:bg-cream/10">View site ↗</Link>
            <form action={logout}><button className="flex min-h-11 items-center gap-2 px-3 text-sm hover:bg-cream/10"><LogOut size={16} />Log out</button></form>
          </div>
        </div>
        <div className="min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"><AdminNav items={items.map(({ href, label }) => ({ href, label, badge: href === "/admin/messages" ? unread ?? 0 : 0 }))} /></div>
        <div className="hidden shrink-0 border-t border-cream/10 px-5 py-4 lg:block">
          <p className="mb-2 truncate text-xs text-cream/60" title={admin.email}>{admin.email}</p>
          <Link href="/" target="_blank" className="mb-1 flex min-h-9 items-center text-sm text-cream/80 hover:text-white">View site ↗</Link>
          <form action={logout}><button className="flex min-h-9 items-center gap-2 text-sm text-cream/80 hover:text-white"><LogOut size={16} />Log out</button></form>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-6 md:px-8 lg:px-10 lg:py-8"><div className="mx-auto max-w-6xl"><AdminBackLink className="-ml-1 mb-2" />{children}</div></div>
    </div>
  );
}
