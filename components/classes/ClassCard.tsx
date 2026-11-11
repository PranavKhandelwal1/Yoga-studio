import Link from "next/link";
import { Clock, MapPin, Video } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatPrice } from "@/lib/utils/format";
import { fmtDate, fmtTime, formatMinutes } from "@/lib/utils/time";
import type { ClassRow, SessionAvailability } from "@/types/db";

export function ClassCard({ c, next }: { c: ClassRow; next: SessionAvailability[] }) {
  return (
    <article className="group flex flex-col">
      <Link href={`/classes/${c.slug}`} className="photo aspect-[4/5]" aria-hidden tabIndex={-1}>
        <SmartImage src={c.image_url ?? ""} alt={c.image_alt ?? c.title} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
      </Link>
      <div className="mt-6 flex flex-1 flex-col">
        <p className="eyebrow !text-[1.0625rem]">{c.delivery === "online" ? "Online" : c.style ?? c.location_name}</p>
        <h3 className="h-sub mt-1"><Link href={`/classes/${c.slug}`}>{c.title}</Link></h3>
        {c.summary && <p className="mt-3 line-clamp-3 text-ink-soft">{c.summary}</p>}
        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Clock size={15} className="text-lotus" aria-hidden />{formatMinutes(c.duration_minutes)}</span>
          <span>{formatPrice(c.price_cents, c.currency)}</span>
          {c.delivery === "online" ? <span className="inline-flex items-center gap-1.5"><Video size={15} className="text-lotus" aria-hidden />Online</span> : c.location_name && <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-lotus" aria-hidden />{c.location_name}</span>}
        </p>
        {next.length > 0 && (
          <p className="mt-1 text-sm text-ink-soft">Next: {next.slice(0, 2).map((s) => `${fmtDate(s.starts_at, { weekday: "short", year: undefined, month: "short" })}, ${fmtTime(s.starts_at)}`).join(", ")}</p>
        )}
        <div className="mt-auto flex gap-7 pt-6">
          <Link href={`/book?class=${c.slug}`} className="link-arrow">Book a place</Link>
          <Link href={`/classes/${c.slug}`} className="link-u self-center text-sm text-ink-soft hover:text-deep">Details</Link>
        </div>
      </div>
    </article>
  );
}
