"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Field, Status, postJson } from "@/components/ui/Form";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtTime } from "@/lib/utils/time";
import { formatPrice } from "@/lib/utils/format";
import { canCancelOnline } from "@/lib/booking/policy";

type Found = { reference: string; full_name: string; participants: number; status: string; payment_status: string; total_price_cents: number | null; currency: string;
  class_sessions: { starts_at: string; ends_at: string; classes: { title: string; location_name: string | null; delivery: string } | null } | null };

const MESSAGE: Record<string, string> = {
  approved: "Your booking is confirmed. We look forward to seeing you.",
  pending: "Your booking is waiting — either for payment or for Angela's approval. You'll get an email as soon as it's confirmed.",
  rejected: "Unfortunately this booking could not be accepted. Please get in touch if you'd like to try another date.",
  cancelled: "This booking was cancelled. If you paid, the refund goes back to your original payment method.",
};

export function BookingLookup({ cancelHours, policy }: { cancelHours: number; policy: string }) {
  const [cancelState, setCancelState] = useState<"idle" | "busy" | "done" | string>("idle"); const [refunded, setRefunded] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [b, setB] = useState<Found | null>(null); const [emailUsed, setEmailUsed] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(null); setB(null);
    const fd = new FormData(e.currentTarget); setEmailUsed(String(fd.get("email") ?? "")); setCancelState("idle");
    const r = await postJson("/api/bookings/lookup", { reference: fd.get("reference"), email: fd.get("email") });
    setBusy(false);
    if (r.ok) setB(r.data?.booking as Found); else setErr(r.error ?? "Something went wrong.");
  }
  const s = b?.class_sessions;
  const canCancel = !!b && !!s && (b.status === "pending" || b.status === "approved") && canCancelOnline(s.starts_at, cancelHours);
  async function cancel() {
    if (!b || !window.confirm("Cancel this booking?" + (b.payment_status === "paid" ? " Your payment will be refunded to your original payment method." : ""))) return;
    setCancelState("busy");
    const r = await postJson("/api/bookings/cancel", { reference: b.reference, email: emailUsed });
    if (r.ok) { setRefunded(Boolean(r.data?.refunded)); setCancelState("done"); setB({ ...b, status: "cancelled" }); } else setCancelState(r.error ?? "Something went wrong.");
  }
  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate>
        <Field label="Booking reference" hint="8 characters, from your confirmation email">{(p) => <input {...p} name="reference" className="input uppercase tracking-widest" required maxLength={16} autoComplete="off" />}</Field>
        <Field label="Email address">{(p) => <input {...p} name="email" type="email" className="input" required autoComplete="email" />}</Field>
        <div className="sm:col-span-2"><button className="btn btn-primary" disabled={busy}><Search size={16} aria-hidden />{busy ? "Searching…" : "Find my booking"}</button></div>
      </form>
      {err && <Status kind="error">{err}</Status>}
      {b && (
        <div role="status" className="border border-forest/30 bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2"><Badge s={b.status} /><Badge s={b.payment_status} /></div>
          <p className="lead mt-4">{MESSAGE[b.status] ?? ""}</p>
          <dl className="mt-6 grid gap-x-8 gap-y-3 border-t border-sage/60 pt-6 sm:grid-cols-[10rem_1fr]">
            <dt className="text-ink-soft">Reference</dt><dd className="font-medium tracking-wider">{b.reference}</dd>
            <dt className="text-ink-soft">Name</dt><dd>{b.full_name}</dd>
            {s?.classes && <><dt className="text-ink-soft">Class</dt><dd>{s.classes.title}{s.classes.delivery === "online" ? " (online)" : ""}</dd></>}
            {s && <><dt className="text-ink-soft">When</dt><dd>{fmtDate(s.starts_at)}, {fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}</dd></>}
            {s?.classes?.location_name && <><dt className="text-ink-soft">Where</dt><dd>{s.classes.location_name}</dd></>}
            <dt className="text-ink-soft">Participants</dt><dd>{b.participants}</dd>
            {b.total_price_cents ? <><dt className="text-ink-soft">Total</dt><dd>{formatPrice(b.total_price_cents, b.currency)}</dd></> : null}
          </dl>
          {cancelState === "done" && <div className="mt-6"><Status kind="success">Your booking is cancelled.{refunded ? " Your refund is on its way — it usually appears within 5–10 working days." : ""}</Status></div>}
          {cancelState !== "idle" && cancelState !== "busy" && cancelState !== "done" && <div className="mt-6"><Status kind="error">{cancelState}</Status></div>}
          {canCancel && cancelState !== "done" && (
            <div className="mt-8 border-t border-line pt-6">
              <button type="button" onClick={cancel} disabled={cancelState === "busy"} className="btn btn-outline">{cancelState === "busy" ? "Cancelling…" : "Cancel this booking"}</button>
              <p className="mt-3 max-w-xl text-sm text-ink-soft">{policy}</p>
            </div>
          )}
          {!canCancel && b.status === "approved" && s && <p className="mt-6 border-t border-line pt-6 text-sm text-ink-soft">{policy} Online cancellation has closed for this class — please get in touch if you can&apos;t come.</p>}
        </div>
      )}
    </div>
  );
}
