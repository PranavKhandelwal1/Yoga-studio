"use client";
import { useFormStatus } from "react-dom";

export function Submit({ children, variant = "primary", small, pendingText = "Saving…" }: { children: React.ReactNode; variant?: "primary" | "outline" | "danger"; small?: boolean; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`btn btn-${variant} ${small ? "btn-sm" : ""}`}>{pending ? pendingText : children}</button>;
}

/** Submit button that asks for confirmation first (destructive actions). */
export function Confirm({ children, message, small = true }: { children: React.ReactNode; message: string; small?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }} className={`btn btn-danger ${small ? "btn-sm" : ""}`}>{pending ? "Working…" : children}</button>;
}
