"use client";
import Link from "next/link";
import { useState } from "react";
import { Field, Honeypot, Status, postJson } from "./Form";

export function PrivateSessionForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setFields({}); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await postJson("/api/private-session", { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined, format: fd.get("format"), participants: Number(fd.get("participants") || 1), preferred: fd.get("preferred") || undefined, goals: fd.get("goals") || undefined, privacyConsent: fd.get("privacyConsent") === "on", website: fd.get("website") });
    setBusy(false);
    if (r.ok) setDone(true); else { setError(r.error ?? "Something went wrong."); setFields(r.fields ?? {}); }
  }
  if (done) return <Status kind="success">Thank you — your request has been sent. Angela will reply by email to agree a time.</Status>;
  const fe = (k: string) => fields[k]?.[0];
  return (
    <form onSubmit={submit} noValidate className="relative space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={fe("name")}>{(p) => <input {...p} name="name" className="input" required autoComplete="name" />}</Field>
        <Field label="Email" error={fe("email")}>{(p) => <input {...p} name="email" type="email" className="input" required autoComplete="email" />}</Field>
        <Field label="Phone" hint="Optional" error={fe("phone")}>{(p) => <input {...p} name="phone" type="tel" className="input" autoComplete="tel" />}</Field>
        <Field label="Number of people" error={fe("participants")}>{(p) => <select {...p} name="participants" className="input">{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select>}</Field>
      </div>
      <Field label="Where would you like to practise?" error={fe("format")}>{(p) => <select {...p} name="format" className="input" defaultValue="either"><option value="in_person">In person, in Mallorca</option><option value="online">Online</option><option value="either">Either is fine</option></select>}</Field>
      <Field label="Days and times that suit you" hint="Optional" error={fe("preferred")}>{(p) => <input {...p} name="preferred" maxLength={400} className="input" placeholder="e.g. weekday mornings" />}</Field>
      <Field label="What are you looking for?" hint="Optional — experience, goals, anything Angela should know" error={fe("goals")}>{(p) => <textarea {...p} name="goals" rows={5} maxLength={2000} className="input" />}</Field>
      <Honeypot />
      <label className="flex items-start gap-3"><input type="checkbox" name="privacyConsent" required className="mt-1.5 h-5 w-5 accent-[#43301f]" /><span className="text-sm">I agree to my details being used to reply to this request, as described in the <Link href="/privacy" target="_blank" className="underline underline-offset-4">privacy policy</Link>.</span></label>
      {fe("privacyConsent") && <p role="alert" className="text-sm text-[#8c2f2f]">{fe("privacyConsent")}</p>}
      {error && <Status kind="error">{error}</Status>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
    </form>
  );
}
