"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-3 lg:pb-0">
      {items.map((i) => {
        const on = path === i.href || path.startsWith(i.href + "/");
        return <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center whitespace-nowrap px-3 text-sm transition-colors ${on ? "bg-cream text-deep" : "text-cream/85 hover:bg-cream/10"}`}>{i.label}{!!i.badge && <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#c0392b] px-1.5 text-xs font-semibold leading-5 text-white" aria-label={`${i.badge} unread`}>{i.badge}</span>}</Link>;
      })}
    </nav>
  );
}
