"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Video, Wallet } from "lucide-react";
import { Field, Honeypot, Status, postJson } from "@/components/ui/Form";
import { fmtDate, fmtTime, formatMinutes } from "@/lib/utils/time";
import { formatPrice } from "@/lib/utils/format";

export type BookClass = { id: string; slug: string; title: string; price_cents: number | null; currency: string; duration_minutes: number; location: string | null; online?: boolean };
export type BookSession = { id: string; classId: string; startsAt: string; endsAt: string; seatsLeft: number };

export function BookingForm({ classes, sessions, initialSessionId, initialClassSlug, payMethods = [] }: { classes: BookClass[]; sessions: BookSession[]; initialSessionId?: string; initialClassSlug?: string; payMethods?: ("card" | "paypal")[] }) {
  const initialSession = sessions.find((s) => s.id === initialSessionId);
  const [classId, setClassId] = useState(initialSession?.classId ?? classes.find((c) => c.slug === initialClassSlug)?.id ?? "");
  const [sessionId, setSessionId] = useState(initialSession && initialSession.seatsLeft > 0 ? initialSession.id : "");
  const [participants, setParticipants] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<{ reference: string } | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const cls = classes.find((c) => c.id === classId);
  const options = useMemo(() => sessions.filter((s) => s.classId === classId), [sessions, classId]);
  const session = options.find((s) => s.id === sessionId);
  const maxP = Math.max(1, Math.min(10, session?.seatsLeft ?? 10));
  const total = cls?.price_cents != null ? cls.price_cents * participants : null;
  const mustPay = payMethods.length > 0 && total != null && total > 0;
  const [method, setMethod] = useState<"card" | "paypal">(payMethods[0] ?? "card");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setFields({});
    const fd = new FormData(e.currentTarget);
    if (!sessionId) { setError("Please choose a date and time."); return; }
    setBusy(true);
    const r = await postJson("/api/bookings", {
      sessionId, participants, paymentMethod: mustPay ? method : undefined, fullName: fd.get("fullName"), email: fd.get("email"), phone: fd.get("phone") || undefined,
      message: fd.get("message") || undefined, privacyConsent: fd.get("privacyConsent") === "on", website: fd.get("website"),
    });
    if (r.ok && typeof r.data?.checkoutUrl === "string") { setRedirecting(true); window.location.assign(r.data.checkoutUrl); return; } // off to the secure payment page (Stripe or PayPal)
    setBusy(false);
    if (r.ok) { setDone({ reference: String(r.data?.reference ?? "") }); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setError(r.error ?? "Something went wrong."); setFields(r.fields ?? {});
  }

  if (done && cls && session) {
    return (
      <div role="status" className="border border-forest/30 bg-white p-8 md:p-12">
        <CheckCircle2 className="text-forest" size={40} aria-hidden />
        <h2 className="h-section mt-4">Request received</h2>
        <p className="lead mt-3">Thank you. Your booking is <strong>pending</strong> — it is not confirmed until Angela approves it. You will receive an email either way.</p>
        <dl className="mt-8 grid gap-x-8 gap-y-3 border-t border-sage/60 pt-6 sm:grid-cols-[10rem_1fr]">
          <dt className="text-ink-soft">Reference</dt><dd className="font-medium tracking-wider">{done.reference}</dd>
          <dt className="text-ink-soft">Class</dt><dd>{cls.title}</dd>
          <dt className="text-ink-soft">When</dt><dd>{fmtDate(session.startsAt)}, {fmtTime(session.startsAt)}–{fmtTime(session.endsAt)}</dd>
          <dt className="text-ink-soft">Participants</dt><dd>{participants}</dd>
          {cls.location && <><dt className="text-ink-soft">Where</dt><dd>{cls.location}</dd></>}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/schedule" className="btn btn-outline">Back to schedule</Link><Link href="/" className="btn btn-primary">Home</Link></div>
      </div>
    );
  }

  const fe = (k: string) => fields[k]?.[0];
  return (
    <form onSubmit={submit} noValidate className="relative space-y-10">
      <fieldset className="space-y-5">
        <legend className="font-serif text-3xl text-deep">1. Choose your class</legend>
        <Field label="Class">
          {(p) => (
            <select {...p} className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setSessionId(""); }} required>
              <option value="">Select a class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.title}{c.online ? " (online)" : ""} — {formatMinutes(c.duration_minutes)} · {formatPrice(c.price_cents, c.currency)}</option>)}
            </select>
          )}
        </Field>
        {cls && (
          <div>
            <p className="label" id="dates-label">Date &amp; time</p>
            {options.length === 0 ? <p className="text-ink-soft">No upcoming dates for this class yet. <Link href="/contact" className="underline underline-offset-4">Ask Angela</Link>.</p> : (
              <div role="radiogroup" aria-labelledby="dates-label" className="grid gap-2 sm:grid-cols-2">
                {options.map((s) => {
                  const full = s.seatsLeft <= 0; const sel = s.id === sessionId;
                  return (
                    <label key={s.id} className={`flex cursor-pointer items-start gap-3 border p-3.5 transition-colors ${full ? "cursor-not-allowed opacity-50" : sel ? "border-forest bg-forest/5" : "border-[#dccfb8] bg-white hover:border-forest"}`}>
                      <input type="radio" name="session" className="mt-1.5 accent-[#43301f]" disabled={full} checked={sel} onChange={() => { setSessionId(s.id); setParticipants((n) => Math.min(n, Math.max(1, s.seatsLeft))); }} />
                      <span><span className="block font-medium text-deep">{fmtDate(s.startsAt, { year: undefined })}</span><span className="block text-sm text-ink-soft">{fmtTime(s.startsAt)}–{fmtTime(s.endsAt)} · {full ? "Full" : `${s.seatsLeft} ${s.seatsLeft === 1 ? "place" : "places"} left`}</span></span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-serif text-3xl text-deep">2. Your details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" error={fe("fullName")}>{(p) => <input {...p} name="fullName" className="input" required minLength={2} maxLength={120} autoComplete="name" />}</Field>
          <Field label="Email address" error={fe("email")}>{(p) => <input {...p} name="email" type="email" className="input" required autoComplete="email" />}</Field>
          <Field label="Phone number" error={fe("phone")} hint="Optional">{(p) => <input {...p} name="phone" type="tel" className="input" autoComplete="tel" />}</Field>
          <Field label="Number of participants" error={fe("participants")}>
            {(p) => <select {...p} className="input" value={participants} onChange={(e) => setParticipants(Number(e.target.value))}>{Array.from({ length: maxP }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select>}
          </Field>
        </div>
        <Field label="Additional message" error={fe("message")} hint="Optional — injuries, experience, questions…">{(p) => <textarea {...p} name="message" rows={4} maxLength={2000} className="input" />}</Field>
        <Honeypot />
      </fieldset>

      {cls && session && (
        <div className="border-t border-sage/60 pt-6 text-ink-soft">
          {cls.online && <p className="mb-2 flex items-center gap-2 text-forest"><Video size={16} aria-hidden />Online class — your private joining link is emailed once your booking is confirmed.</p>}
          <p><strong className="text-deep">{cls.title}</strong> · {fmtDate(session.startsAt)}, {fmtTime(session.startsAt)} · {participants} {participants === 1 ? "person" : "people"}</p>
          <p className="mt-1">{total != null ? <>Total: <strong className="text-deep">{formatPrice(total, cls.currency)}</strong>{mustPay ? " — paid securely on the next step" : " (confirmed by Angela with your booking)"}</> : "Price on request"}</p>
        </div>
      )}

      {mustPay && payMethods.length > 1 && (
        <fieldset>
          <legend className="font-serif text-3xl text-deep">3. Pay with</legend>
          <div role="radiogroup" className="mt-4 grid gap-2 sm:grid-cols-2">
            {payMethods.map((m) => (
              <label key={m} className={`flex min-h-14 cursor-pointer items-center gap-3 border p-3.5 transition-colors ${method === m ? "border-forest bg-forest/5" : "border-[#dccfb8] bg-white hover:border-forest"}`}>
                <input type="radio" name="payMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="accent-[#43301f]" />
                {m === "card" ? <><CreditCard size={20} aria-hidden /><span><span className="block font-medium text-deep">Card</span><span className="block text-sm text-ink-soft">Visa, Mastercard, Apple Pay, Google Pay</span></span></>
                  : <><Wallet size={20} aria-hidden /><span><span className="block font-medium text-deep">PayPal</span><span className="block text-sm text-ink-soft">Pay with your PayPal account</span></span></>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="privacyConsent" required className="mt-1.5 h-5 w-5 accent-[#43301f]" />
          <span className="text-sm">I agree to my details being stored and used to handle this request, as described in the <Link href="/privacy" target="_blank" className="underline underline-offset-4">privacy policy</Link>.</span>
        </label>
        {fe("privacyConsent") && <p role="alert" className="mt-1 text-sm text-[#8c2f2f]">{fe("privacyConsent")}</p>}
      </div>

      {error && <Status kind="error">{error}</Status>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={busy || redirecting || !sessionId}>{redirecting ? "Taking you to secure payment…" : busy ? "Sending…" : mustPay ? `${method === "paypal" ? "Pay with PayPal" : "Continue to payment"} · ${formatPrice(total, cls?.currency)}` : "Send booking request"}</button>
        <p className="text-sm text-ink-soft">{mustPay ? "Your place is held for 30 minutes and confirmed as soon as your payment succeeds." : "Nothing is confirmed until Angela approves your request."}</p>
      </div>
    </form>
  );
}
