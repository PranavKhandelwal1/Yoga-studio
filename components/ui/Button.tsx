import Link from "next/link";
import { cn } from "@/lib/utils/format";

export type Variant = "primary" | "outline" | "light" | "gold" | "ghost-light" | "danger";
export const btn = (variant: Variant = "primary", small = false) => cn("btn", `btn-${variant}`, small && "btn-sm");

export function ButtonLink({ href, variant = "primary", small, children, className, ...rest }:
  { href: string; variant?: Variant; small?: boolean; children: React.ReactNode; className?: string } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return <Link href={href} className={cn(btn(variant, small), className)} {...rest}>{children}</Link>;
}
