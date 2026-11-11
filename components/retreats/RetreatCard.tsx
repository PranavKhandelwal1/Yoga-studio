import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatPrice } from "@/lib/utils/format";
import { retreatDates, placesLeft } from "@/lib/utils/retreat";
import type { RetreatRow } from "@/types/db";

export function RetreatCard({ r }: { r: RetreatRow }) {
  const left = placesLeft(r);
  return (
    <article className="group grid gap-8 md:grid-cols-2 md:gap-16">
      <Link href={`/retreats/${r.slug}`} className="photo aspect-[4/3]" aria-hidden tabIndex={-1}>
        <SmartImage src={r.hero_image_url ?? ""} alt={r.hero_image_alt ?? r.title} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
      </Link>
      <div className="flex flex-col justify-center">
        <h3 className="h-section"><Link href={`/retreats/${r.slug}`} className="">{r.title}</Link></h3>
        {r.summary && <p className="mt-4 text-ink-soft">{r.summary}</p>}
        <ul className="mt-5 space-y-2 text-sm text-ink-soft">
          {r.location && <li className="flex items-center gap-2"><MapPin size={16} />{r.location}</li>}
          <li className="flex items-center gap-2"><CalendarDays size={16} />{retreatDates(r)}</li>
        </ul>
        <p className="mt-4 font-serif text-2xl text-deep">{formatPrice(r.price_cents, r.currency)}{left !== null && <span className="ml-3 font-sans text-sm text-ink-soft">{left > 0 ? `${left} places left` : "Fully booked"}</span>}</p>
        <div className="mt-6"><Link href={`/retreats/${r.slug}`} className="link-arrow">View retreat</Link></div>
      </div>
    </article>
  );
}
