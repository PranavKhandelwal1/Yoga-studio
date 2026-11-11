"use client";
import { useState } from "react";
import { Honeypot, Status, postJson } from "./Form";

export function NewsletterForm({ tone = "light", source = "website" }: { tone?: "light" | "dark"; source?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("busy");
    const r = await postJson("/api/newsletter", { email: fd.get("email"), website: fd.get("website"), source });
    setState(r.ok ? "done" : r.error ?? "Something went wrong.");
  }
  if (state === "done") return <Status kind="success">Thank you — you're on the list.</Status>;
  return (
    <form onSubmit={submit} noValidate className="relative">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`nl-${source}`} className="sr-only">Email address</label>
        <input id={`nl-${source}`} name="email" type="email" required autoComplete="email" placeholder="Your email address" className="input flex-1" />
        <button type="submit" disabled={state === "busy"} className={`btn ${tone === "dark" ? "btn-light" : "btn-primary"}`}>{state === "busy" ? "Sending…" : "Subscribe"}</button>
      </div>
      <Honeypot />
      {state !== "idle" && state !== "busy" && <div className="mt-3"><Status kind="error">{state}</Status></div>}
    </form>
  );
}
