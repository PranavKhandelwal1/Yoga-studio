"use client";
import Link from "next/link";
import { useState } from "react";
import { Field, Honeypot, Status, postJson } from "@/components/ui/Form";
import { formatPrice } from "@/lib/utils/format";

export function EnquiryForm({ retreatId, retreatTitle, canBook, maxParticipants, deposit, methods = [] }: { retreatId: string; retreatTitle: string; canBook: boolean; maxParticipants: number; deposit?: { perPersonCents: number; currency: string } | null; methods?: ("card" | "paypal")[] }) {
  const payNowAvailable = !!deposit && methods.length > 0;
  const [people, setPeople] = useState(1);
  const [method, setMethod] = useState<"card" | "paypal">(methods[0] ?? "card");
  const [kind, setKind] = useState<"enquiry" | "booking_request">(canBook ? "booking_request" : "enquiry");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setFields({}); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await postJson("/api/retreat-enquiries", { retreatId, kind, fullName: fd.get("fullName"), email: fd.get("email"), phone: fd.get("phone") || undefined, participants: Number(fd.get("participants") || 1), payMethod: kind === "booking_request" && payNowAvailable ? method : undefined, message: fd.get("message") || undefined, privacyConsent: fd.get("privacyConsent") === "on", website: fd.get("website") });
    if (r.ok && typeof r.data?.checkoutUrl === "string") { window.location.assign(r.data.checkoutUrl); return; } // off to the secure payment page
    setBusy(false);
    if (r.ok) setDone(kind === "booking_request" ? "Thank you — your booking request has been received. Angela will contact you to confirm your place and payment details." : "Thank you — your enquiry has been sent. Angela will reply soon.");
    else { setError(r.error ?? "Something went wrong."); setFields(r.fields ?? {}); }
  }
  if (done) return <Status kind="success">{done}</Status>;
  const fe = (k: string) => fields[k]?.[0];
  return (
    <form onSubmit={submit} noValidate className="relative space-y-5" aria-label={`Enquiry about ${retreatTitle}`}>
      <div role="radiogroup" aria-label="Type of request" className="flex flex-wrap gap-2">
        {canBook && <button type="button" role="radio" aria-checked={kind === "booking_request"} onClick={() => setKind("booking_request")} className={`min-h-11 border px-4 text-[0.8125rem] ${kind === "booking_request" ? "border-deep bg-deep text-cream" : "border-sage"}`}>Request a place</button>}
        <button type="button" role="radio" aria-checked={kind === "enquiry"} onClick={() => setKind("enquiry")} className={`min-h-11 border px-4 text-[0.8125rem] ${kind === "enquiry" ? "border-deep bg-deep text-cream" : "border-sage"}`}>Ask a question</button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={fe("fullName")}>{(p) => <input {...p} name="fullName" className="input" required autoComplete="name" />}</Field>
        <Field label="Email" error={fe("email")}>{(p) => <input {...p} name="email" type="email" className="input" required autoComplete="email" />}</Field>
        <Field label="Phone" hint="Optional" error={fe("phone")}>{(p) => <input {...p} name="phone" type="tel" className="input" autoComplete="tel" />}</Field>
        <Field label="Participants" error={fe("participants")}>{(p) => <select {...p} name="participants" className="input" value={people} onChange={(e) => setPeople(Number(e.target.value))}>{Array.from({ length: Math.min(maxParticipants, 10) }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select>}</Field>
      </div>
      <Field label="Message" hint="Optional" error={fe("message")}>{(p) => <textarea {...p} name="message" rows={4} maxLength={4000} className="input" />}</Field>
      {kind === "booking_request" && payNowAvailable && deposit && (
        <fieldset className="space-y-3 border-t border-line pt-5">
          <legend className="text-sm text-ink-soft">Reserve with a deposit of <strong className="font-medium text-deep">{formatPrice(deposit.perPersonCents * people, deposit.currency)}</strong> ({formatPrice(deposit.perPersonCents, deposit.currency)} per person). Your places are confirmed as soon as the payment goes through.</legend>
          {methods.length > 1 && (
            <div role="radiogroup" aria-label="Payment method" className="flex gap-2">
              {methods.map((m) => <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={`min-h-11 border px-5 text-sm ${method === m ? "border-deep bg-deep text-cream" : "border-line"}`}>{m === "card" ? "Card" : "PayPal"}</button>)}
            </div>
          )}
        </fieldset>
      )}
      <Honeypot />
      <label className="flex items-start gap-3"><input type="checkbox" name="privacyConsent" required className="mt-1.5 h-5 w-5 accent-[#43301f]" /><span className="text-sm">I agree to my details being stored and used to reply, as described in the <Link href="/privacy" target="_blank" className="underline underline-offset-4">privacy policy</Link>.</span></label>
      {fe("privacyConsent") && <p role="alert" className="text-sm text-[#8c2f2f]">{fe("privacyConsent")}</p>}
      {error && <Status kind="error">{error}</Status>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Please wait…" : kind === "booking_request" ? (payNowAvailable && deposit ? `Pay deposit · ${formatPrice(deposit.perPersonCents * people, deposit.currency)}` : "Send booking request") : "Send enquiry"}</button>
    </form>
  );
}
