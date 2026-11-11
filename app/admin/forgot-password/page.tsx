import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "../actions";
import { Flash, aInput } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default async function Forgot({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md border border-sage/60 bg-white p-8 md:p-10">
        <h1 className="font-serif text-4xl text-deep">Reset password</h1>
        <p className="mt-3 text-ink-soft">Enter your admin email and we'll send a reset link.</p>
        <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
        <form action={requestPasswordReset} className="space-y-5">
          <div><label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label><input id="email" name="email" type="email" required autoComplete="email" className={aInput} /></div>
          <Submit pendingText="Sending…">Send reset link</Submit>
        </form>
        <p className="mt-6 text-sm"><Link href="/admin/login" className="underline underline-offset-4">Back to sign in</Link></p>
      </div>
    </main>
  );
}
