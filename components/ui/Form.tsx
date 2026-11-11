"use client";
import { useId } from "react";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (p: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode }) {
  const id = useId();
  const desc = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": desc })}
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-sm text-[#8c2f2f]">{error}</p> : hint ? <p id={`${id}-h`} className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** Hidden honeypot field: humans never see or fill it; bots do. */
export function Honeypot() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
      <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
    </div>
  );
}

export function Status({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`border-l-2 px-4 py-3 text-sm ${kind === "error" ? "border-[#8c2f2f] bg-[#f6e9e7] text-[#6e2323]" : "border-forest bg-sage/25 text-deep"}`}>
      {children}
    </div>
  );
}

export type ApiResult = { ok: boolean; status: number; error?: string; fields?: Record<string, string[]>; data?: Record<string, unknown> };
export async function postJson(url: string, body: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, error: data.error, fields: data.fields, data };
  } catch {
    return { ok: false, status: 0, error: "Network error. Please check your connection and try again." };
  }
}
