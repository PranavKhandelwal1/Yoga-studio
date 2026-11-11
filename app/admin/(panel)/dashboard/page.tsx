import Link from "next/link";
import { AdminTitle, Badge, Card, Empty } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/utils/time";
import { formatPrice } from "@/lib/utils/format";
import { payMethods } from "@/lib/payments/methods";
import { DEFAULT_ALT } from "@/lib/content/constants";
import { CheckCircle2, Circle } from "lucide-react";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type Upcoming = { id: string; starts_at: string; capacity: number; classes: { title: string } | null; bookings: { participants: number; status: string }[] };
type Paid = { amount_paid_cents: number | null; payment_status: string };

type Recent = { id: string; reference: string; full_name: string; participants: number; status: string; created_at: string; class_sessions: { starts_at: string; classes: { title: string } | null } | null };

export default async function Dashboard() {
  const db = await createClient();
  const nowIso = new Date().toISOString();
  // Supabase returns at most 1,000 rows per request, so read the payments page by page — otherwise the totals would silently stop growing.
  const allPaid = async (table: "bookings" | "retreat_enquiries"): Promise<Paid[]> => {
    const out: Paid[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from(table).select("amount_paid_cents,payment_status").in("payment_status", ["paid", "refunded"]).order("id").range(from, from + 999);
      out.push(...((data ?? []) as Paid[]));
      if ((data?.length ?? 0) < 1000) return out;
    }
  };
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [total, pending, approved, upcoming, retreats, subs, enquiries, recent, altCount, testimonials, noPrice, bioRow, privacyRow, bookingSetting, unread, sessions, paidBookings, paidRetreats] = await Promise.all([
    count(db.from("bookings").select("id", { count: "exact", head: true })),
    count(db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "approved")),
    count(db.from("class_sessions").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("starts_at", nowIso)),
    count(db.from("retreats").select("id", { count: "exact", head: true }).neq("status", "archived")),
    count(db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "subscribed")),
    count(db.from("retreat_enquiries").select("id", { count: "exact", head: true }).eq("status", "new")),
    db.from("bookings").select("id,reference,full_name,participants,status,created_at,class_sessions(starts_at,classes(title))").order("created_at", { ascending: false }).limit(8),
    count(db.from("gallery_images").select("id", { count: "exact", head: true }).or(`alt.eq.${DEFAULT_ALT},alt.eq.`)),
    count(db.from("testimonials").select("id", { count: "exact", head: true }).eq("status", "published")),
    count(db.from("classes").select("id", { count: "exact", head: true }).neq("status", "archived").is("price_cents", null)),
    db.from("pages").select("content").eq("slug", "about").maybeSingle(),
    db.from("pages").select("id").eq("slug", "privacy").maybeSingle(),
    db.from("site_settings").select("key").eq("key", "booking").maybeSingle(),
    count(db.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new")),
    db.from("class_sessions").select("id,starts_at,capacity,classes(title),bookings(participants,status)").eq("status", "scheduled").gte("starts_at", nowIso).order("starts_at").limit(6),
    allPaid("bookings"),
    allPaid("retreat_enquiries"),
  ]);
  // Money: "received" counts every payment that came in (including ones later refunded); "refunded" is the part given back.
  const payRows = [...paidBookings, ...paidRetreats];
  const received = payRows.reduce((n, r) => n + (r.amount_paid_cents ?? 0), 0);
  const refunded = payRows.filter((r) => r.payment_status === "refunded").reduce((n, r) => n + (r.amount_paid_cents ?? 0), 0);
  const nextClasses = ((sessions.data ?? []) as unknown as Upcoming[]).map((x) => ({ ...x, taken: x.bookings.filter((b) => b.status === "pending" || b.status === "approved").reduce((n, b) => n + b.participants, 0) }));
  const stats = [
    ["Total bookings", total, "/admin/bookings"], ["Pending", pending, "/admin/bookings?status=pending"], ["Approved", approved, "/admin/bookings?status=approved"],
    ["Upcoming classes", upcoming, "/admin/classes"], ["Retreats", retreats, "/admin/retreats"], ["Newsletter subscribers", subs, "/admin/newsletter"], ["New retreat enquiries", enquiries, "/admin/retreats"], ["Unread messages", unread, "/admin/messages?status=new"],
  ] as const;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const bio = String((bioRow.data?.content as Record<string, unknown> | null)?.bio_body ?? "").trim();
  const checklist: { done: boolean; label: string; href: string; hint: string }[] = [
    { done: bio.length > 80, label: "Write Angela's biography", href: "/admin/content/about", hint: "The About page shows a placeholder until you add your own words." },
    { done: altCount === 0, label: "Describe your gallery photos", href: "/admin/gallery", hint: `${altCount} photo${altCount === 1 ? "" : "s"} still ha${altCount === 1 ? "s" : "ve"} the generic description. Short, honest descriptions help visually impaired visitors and Google.` },
    { done: testimonials > 0, label: "Add a few real testimonials", href: "/admin/testimonials", hint: "Quotes from students are the strongest thing on a booking page." },
    { done: noPrice === 0, label: "Set a price on every class", href: "/admin/classes", hint: `${noPrice} class${noPrice === 1 ? " has" : "es have"} no price, so ${noPrice === 1 ? "it" : "they"} can't be paid for online.` },
    { done: Boolean(privacyRow.data), label: "Review and save the privacy policy", href: "/admin/content/privacy", hint: "The default text is a starting point. Have it checked before launch." },
    { done: Boolean(bookingSetting.data), label: "Confirm your cancellation policy", href: "/admin/settings", hint: "Default: free cancellation up to 24 hours before. Open Settings → Booking & cancellation and save your own rule." },
    { done: payMethods().length > 0, label: "Turn on online payments", href: "/admin/settings", hint: "Add Stripe and/or PayPal keys to the environment variables." },
    { done: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), label: "Set up email (Resend)", href: "/admin/settings", hint: "Needed for confirmations, reminders and notifications." },
    { done: Boolean(process.env.CRON_SECRET), label: "Enable reminder emails", href: "/admin/settings", hint: "Set CRON_SECRET in the environment variables (see the README)." },
    { done: /^https:\/\/(?!localhost)/.test(siteUrl), label: "Set the live site address", href: "/admin/settings", hint: "NEXT_PUBLIC_SITE_URL must be https://bewithyoga.live when you go live, so payment returns and emails link correctly." },
  ];
  const left = checklist.filter((c) => !c.done).length;
  const rows = (recent.data ?? []) as unknown as Recent[];
  return (
    <>
      <AdminTitle title="Dashboard" sub="An overview of what needs your attention." />
      {payMethods().length === 0 && <div className="mb-6 border-l-4 border-[#8c2f2f] bg-[#f6e9e7] px-4 py-3 text-sm"><strong>Online payments are not set up.</strong> Bookings are not being paid for online — visitors send requests that you approve by hand. Add Stripe keys (<code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>) and/or PayPal keys (<code>PAYPAL_CLIENT_ID</code>, <code>PAYPAL_CLIENT_SECRET</code>) to enable pay-first booking (see README).</div>}
      {pending > 0 && <div className="mb-6 border-l-4 border-[#b58a1b] bg-[#f8efd2] px-4 py-3 text-sm"><strong>{pending}</strong> booking {pending === 1 ? "request is" : "requests are"} waiting for your decision. <Link href="/admin/bookings?status=pending" className="font-medium underline underline-offset-4">Review now</Link></div>}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([l, n, h]) => (
          <Link key={l} href={h} className="border border-sage/60 bg-white p-4 transition-colors hover:border-forest"><dd className="font-serif text-4xl text-deep">{n}</dd><dt className="mt-1 text-sm text-ink-soft">{l}</dt></Link>
        ))}
      </dl>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {([["Total received", received, ""], ["Refunded", refunded, ""], ["Kept after refunds", received - refunded, ""]] as const).map(([l, c]) => (
          <div key={l} className="border border-sage/60 bg-white p-4"><p className="font-serif text-4xl text-deep">{formatPrice(c)}</p><p className="mt-1 text-sm text-ink-soft">{l}</p></div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-soft">Online payments for classes and retreat deposits, in euros. Processor fees (Stripe, PayPal) are not deducted.</p>
      {left > 0 && (
        <Card title={`Before you go live — ${left} to do`} className="mt-8">
          <ul className="divide-y divide-sage/40">
            {checklist.map((c) => (
              <li key={c.label} className="flex gap-3 py-3">
                {c.done ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-forest" aria-label="Done" /> : <Circle size={20} className="mt-0.5 shrink-0 text-ink-soft" aria-label="To do" />}
                <div className={c.done ? "text-ink-soft" : ""}><Link href={c.href} className={`font-medium ${c.done ? "line-through" : "text-deep underline underline-offset-4"}`}>{c.label}</Link>{!c.done && <p className="text-sm text-ink-soft">{c.hint}</p>}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Upcoming classes" className="mt-8">
        {nextClasses.length === 0 ? <Empty>No upcoming classes scheduled.</Empty> : (
          <ul className="divide-y divide-sage/40">
            {nextClasses.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><span className="font-medium">{c.classes?.title ?? "Class"}</span> <span className="text-ink-soft">· {fmtDateTime(c.starts_at)}</span></span>
                <span className="text-sm text-ink-soft">{c.taken} / {c.capacity} places booked</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/classes" className="mt-3 inline-block text-sm text-forest underline underline-offset-4">Manage classes</Link>
      </Card>
      <Card title="Recent booking requests" className="mt-8">
        {rows.length === 0 ? <Empty>No booking requests yet.</Empty> : (
          <ul className="divide-y divide-sage/40">
            {rows.map((b) => (
              <li key={b.id}><Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-cream/60">
                <span><span className="font-medium">{b.full_name}</span> <span className="text-ink-soft">· {b.participants} · {b.class_sessions?.classes?.title ?? "—"}{b.class_sessions && ` · ${fmtDateTime(b.class_sessions.starts_at)}`}</span></span>
                <Badge s={b.status} />
              </Link></li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
