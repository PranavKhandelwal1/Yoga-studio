"use client";
import Link from "next/link";
import { useState } from "react";
import { Field, Honeypot, Status, postJson } from "./Form";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setFields({}); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await postJson("/api/contact", { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined, subject: fd.get("subject") || undefined, message: fd.get("message"), privacyConsent: fd.get("privacyConsent") === "on", website: fd.get("website") });
    setBusy(false);
    if (r.ok) setDone(true); else { setError(r.error ?? "Something went wrong."); setFields(r.fields ?? {}); }
  }
  if (done) return <Status kind="success">Thank you — your message has been sent. Angela will get back to you soon.</Status>;
  const fe = (k: string) => fields[k]?.[0];
  return (
    <form onSubmit={submit} noValidate className="relative space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={fe("name")}>{(p) => <input {...p} name="name" className="input" required autoComplete="name" />}</Field>
        <Field label="Email" error={fe("email")}>{(p) => <input {...p} name="email" type="email" className="input" required autoComplete="email" />}</Field>
        <Field label="Phone" error={fe("phone")} hint="Optional">{(p) => <input {...p} name="phone" type="tel" className="input" autoComplete="tel" />}</Field>
        <Field label="Subject" error={fe("subject")} hint="Optional">{(p) => <input {...p} name="subject" className="input" />}</Field>
      </div>
      <Field label="Message" error={fe("message")}>{(p) => <textarea {...p} name="message" rows={6} required minLength={5} maxLength={4000} className="input" />}</Field>
      <Honeypot />
      <label className="flex items-start gap-3"><input type="checkbox" name="privacyConsent" required className="mt-1.5 h-5 w-5 accent-[#43301f]" /><span className="text-sm">I agree to my details being used to reply to this message, as described in the <Link href="/privacy" target="_blank" className="underline underline-offset-4">privacy policy</Link>.</span></label>
      {fe("privacyConsent") && <p role="alert" className="text-sm text-[#8c2f2f]">{fe("privacyConsent")}</p>}
      {error && <Status kind="error">{error}</Status>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
    </form>
  );
}
