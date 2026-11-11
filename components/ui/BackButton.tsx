"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Admin sections that have their own list page. A detail/new/edit page inside one of them gets a "Back to …" link. */
const SECTIONS: Record<string, string> = {
  bookings: "Bookings", classes: "Classes", retreats: "Retreats", blog: "Journal", content: "Content",
};

/**
 * Shown only on admin pages that sit one level below a section list (e.g. /admin/bookings/123 → /admin/bookings).
 * It is a plain link to a page that is known to exist, so it can never lead to "page not found".
 * The public website has no Back button — its pages have the menu and breadcrumbs instead.
 */
export function AdminBackLink({ className = "" }: { className?: string }) {
  const path = usePathname();
  const [, admin, section, child] = path.split("/");
  if (admin !== "admin" || !child || !(section in SECTIONS)) return null;
  return (
    <Link href={`/admin/${section}`} className={`inline-flex min-h-11 items-center gap-2 text-sm text-forest transition-colors hover:text-deep ${className}`}>
      <ArrowLeft size={16} aria-hidden /> Back to {SECTIONS[section]}
    </Link>
  );
}
