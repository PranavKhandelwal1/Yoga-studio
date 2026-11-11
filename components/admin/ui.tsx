import Link from "next/link";
import { cn } from "@/lib/utils/format";

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return <div role={err ? "alert" : "status"} className={cn("mb-6 border-l-4 px-4 py-3 text-sm", err ? "border-[#8c2f2f] bg-[#f6e9e7] text-[#6e2323]" : "border-forest bg-sage/25 text-deep")}>{err ?? ok}</div>;
}
export const flashProps = (sp: { ok?: string; err?: string }) => ({ ok: sp.ok, err: sp.err });

export function AdminTitle({ title, children, sub }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-serif text-4xl text-deep">{title}</h1>{sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return <section className={cn("border border-sage/60 bg-white p-5 md:p-6", className)}>{title && <h2 className="mb-4 font-serif text-2xl text-deep">{title}</h2>}{children}</section>;
}

const COLORS: Record<string, string> = {
  pending: "bg-[#f3e6c4] text-[#6b5314]", approved: "bg-[#d4e4d0] text-[#1d4a2a]", rejected: "bg-[#f1d6d3] text-[#7a2420]", cancelled: "bg-[#ebe2d1] text-[#5a4733]",
  published: "bg-[#d4e4d0] text-[#1d4a2a]", draft: "bg-[#ebe2d1] text-[#5a4733]", archived: "bg-[#ebe2d1] text-[#5a4733]", scheduled: "bg-[#dfe6f3] text-[#25396b]",
  new: "bg-[#f3e6c4] text-[#6b5314]", contacted: "bg-[#dfe6f3] text-[#25396b]", confirmed: "bg-[#d4e4d0] text-[#1d4a2a]", closed: "bg-[#ebe2d1] text-[#5a4733]",
  read: "bg-[#dfe6f3] text-[#25396b]", replied: "bg-[#d4e4d0] text-[#1d4a2a]", subscribed: "bg-[#d4e4d0] text-[#1d4a2a]", paid: "bg-[#d4e4d0] text-[#1d4a2a]", unpaid: "bg-[#f3e6c4] text-[#6b5314]", refunded: "bg-[#dfe6f3] text-[#25396b]", not_required: "bg-[#ebe2d1] text-[#5a4733]", unsubscribed: "bg-[#ebe2d1] text-[#5a4733]",
};
export const Unread = () => <span className="inline-block bg-[#c0392b] px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white">Unread</span>;
export const Badge = ({ s }: { s: string }) => <span className={cn("inline-block px-2 py-0.5 text-xs font-medium uppercase tracking-wider", COLORS[s] ?? "bg-[#ebe2d1]")}>{s}</span>;

export const aInput = "w-full border border-[#dccfb8] bg-white px-3 py-2 text-[0.95rem] focus:border-forest focus:outline-2 focus:outline-forest min-h-10";
export function F({ label, name, hint, children, className }: { label: string; name?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label htmlFor={name} className="mb-1 block text-sm font-medium text-deep">{label}</label>{children}{hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}</div>;
}
export const TextIn = ({ label, name, defaultValue, type = "text", hint, required, className, ...r }: { label: string; name: string; defaultValue?: string | number | null; type?: string; hint?: string; required?: boolean; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) =>
  <F label={label} name={name} hint={hint} className={className}><input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} className={aInput} {...r} /></F>;
export const AreaIn = ({ label, name, defaultValue, rows = 4, hint, className }: { label: string; name: string; defaultValue?: string | null; rows?: number; hint?: string; className?: string }) =>
  <F label={label} name={name} hint={hint} className={className}><textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? ""} className={aInput} /></F>;
export const SelectIn = ({ label, name, defaultValue, options, className, hint }: { label: string; name: string; defaultValue?: string | null; options: [string, string][]; className?: string; hint?: string }) =>
  <F label={label} name={name} hint={hint} className={className}><select id={name} name={name} defaultValue={defaultValue ?? ""} className={aInput}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></F>;
export const Check = ({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) =>
  <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[#43301f]" />{label}</label>;

export const Empty = ({ children }: { children: React.ReactNode }) => <p className="border border-dashed border-sage bg-white/60 p-8 text-center text-ink-soft">{children}</p>;
export const LinkBtn = ({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "outline" }) => <Link href={href} className={`btn btn-sm ${variant === "primary" ? "btn-primary" : "btn-outline"}`}>{children}</Link>;

export const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => (
  <div className="overflow-x-auto border border-sage/60 bg-white">
    <table className="w-full min-w-[40rem] text-left text-sm">
      <thead className="border-b border-sage/60 bg-cream text-xs uppercase tracking-wider text-forest"><tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-sage/40 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top">{children}</tbody>
    </table>
  </div>
);
