import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminTitle, AreaIn, Badge, Card, Flash } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/utils/time";
import { formatPrice } from "@/lib/utils/format";
import { canTransition } from "@/lib/booking/service";
import { payMethods } from "@/lib/payments/methods";
import { decideBooking, saveBookingNotes } from "../actions";

export const metadata = { title: "Booking" };
export const dynamic = "force-dynamic";

export default async function BookingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createClient();
  const { data: b } = await db.from("bookings").select("*,class_sessions(id,starts_at,ends_at,capacity,status,classes(id,title,location_name))").eq("id", id).maybeSingle();
  if (!b) notFound();
  const { data: events } = await db.from("booking_events").select("*").eq("booking_id", id).order("created_at", { ascending: true });
  const s = b.class_sessions as { id: string; starts_at: string; ends_at: string; capacity: number; status: string; classes: { id: string; title: string; location_name: string | null } | null };
  const path = `/admin/bookings/${id}`;
  const actions: { a: "approve" | "reject" | "cancel"; to: string; label: string; variant: "primary" | "outline" | "danger" }[] = [
    { a: "approve", to: "approved", label: "Approve", variant: "primary" }, { a: "reject", to: "rejected", label: "Reject", variant: "outline" }, { a: "cancel", to: "cancelled", label: "Cancel booking", variant: "danger" },
  ];
  const awaitingPayment = b.status === "pending" && b.payment_status === "unpaid" && (b.total_price_cents ?? 0) > 0 && payMethods().length > 0;
  const available = actions.filter((x) => canTransition(b.status, x.to) && !(awaitingPayment && x.a === "approve"));
  return (
    <>
      <AdminTitle title={b.full_name} sub={`Reference ${b.reference}`}><Link href="/admin/bookings" className="btn btn-outline btn-sm">← All bookings</Link></AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Participant" className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="text-ink-soft">Status</dt><dd><Badge s={b.status} /></dd>
            <dt className="text-ink-soft">Email</dt><dd><a href={`mailto:${b.email}`} className="underline underline-offset-4">{b.email}</a></dd>
            <dt className="text-ink-soft">Phone</dt><dd>{b.phone ?? "—"}</dd>
            <dt className="text-ink-soft">Class</dt><dd>{s.classes?.title}</dd>
            <dt className="text-ink-soft">When</dt><dd>{fmtDateTime(s.starts_at)} (Mallorca time){s.status === "cancelled" && " — session cancelled"}</dd>
            <dt className="text-ink-soft">Participants</dt><dd>{b.participants}</dd>
            <dt className="text-ink-soft">Price</dt><dd>{formatPrice(b.total_price_cents, b.currency)}</dd>
            <dt className="text-ink-soft">Payment</dt><dd><Badge s={b.payment_status} />{b.paid_at && <span className="ml-2 text-ink-soft">{fmtDateTime(b.paid_at)}</span>}{b.payment_provider && <span className="ml-2 text-xs uppercase tracking-wider text-ink-soft">{b.payment_provider === "paypal" ? "PayPal" : "Card"}</span>}{(b.paypal_capture_id ?? b.stripe_payment_intent) && <span className="ml-2 font-mono text-xs text-ink-soft">{b.paypal_capture_id ?? b.stripe_payment_intent}</span>}</dd>
            <dt className="text-ink-soft">Requested</dt><dd>{fmtDateTime(b.created_at)}</dd>
            <dt className="text-ink-soft">Message</dt><dd className="whitespace-pre-line">{b.message ?? "—"}</dd>
          </dl>
        </Card>
        <Card title="Decision">
          {awaitingPayment && <p className="mb-4 border-l-4 border-[#b58a1b] bg-[#f8efd2] px-3 py-2 text-sm">Awaiting the visitor&apos;s payment. It confirms automatically when they pay; unpaid places are released after about 30 minutes.</p>}
          {available.length === 0 ? <p className="text-sm text-ink-soft">{awaitingPayment ? "You can still cancel this booking." : `This booking is ${b.status}; no further action is possible.`}</p> : (
            <div className="space-y-4">
              {available.map((x) => (
                <form key={x.a} action={decideBooking} className="space-y-2 border-b border-sage/40 pb-4 last:border-0 last:pb-0">
                  <input type="hidden" name="bookingId" value={id} /><input type="hidden" name="action" value={x.a} /><input type="hidden" name="returnTo" value={path} />
                  <label className="block text-xs text-ink-soft" htmlFor={`n-${x.a}`}>Optional note to include in the email</label>
                  <input id={`n-${x.a}`} name="note" maxLength={1000} className="w-full border border-[#dccfb8] px-3 py-2 text-sm" />
                  {x.a === "cancel" && b.payment_status === "paid" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="refund" defaultChecked className="h-4 w-4 accent-[#43301f]" />Refund {formatPrice(b.total_price_cents, b.currency)} to the customer</label>}
                  <Submit variant={x.variant} small pendingText="Working…">{x.label}</Submit>
                </form>
              ))}
            </div>
          )}
        </Card>
        <Card title="Internal notes" className="lg:col-span-2">
          <form action={saveBookingNotes} className="space-y-3"><input type="hidden" name="bookingId" value={id} /><AreaIn label="Only visible to admins" name="admin_notes" defaultValue={b.admin_notes} rows={5} /><Submit small>Save notes</Submit></form>
        </Card>
        <Card title="History">
          <ol className="space-y-3 text-sm">
            {(events ?? []).map((e) => (
              <li key={e.id} className="border-l-2 border-sage pl-3"><p className="font-medium">{e.event === "created" ? "Request received" : e.event === "status_changed" ? `${e.from_status} → ${e.to_status}` : e.event === "payment_received" ? "Payment received" : e.event === "refunded" ? "Refunded" : "Notes updated"}</p><p className="text-xs text-ink-soft">{fmtDateTime(e.created_at)}{e.actor ? " · admin" : ""}</p></li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
