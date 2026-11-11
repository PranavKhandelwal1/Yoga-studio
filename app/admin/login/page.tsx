import type { Metadata } from "next";
import { login } from "../actions";
import { Flash } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";
import { aInput } from "@/components/admin/ui";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin login", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md border border-sage/60 bg-white p-8 md:p-10">
        <p className="eyebrow">Be With Yoga</p>
        <h1 className="mt-2 font-serif text-4xl text-deep">Admin sign in</h1>
        <div className="mt-6"><Flash ok={sp.ok} err={sp.err} />
          {!isSupabaseConfigured() && <Flash err="Supabase isn't configured yet — add your keys to .env.local (see README)." />}
        </div>
        <form action={login} className="space-y-5">
          <div><label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label><input id="email" name="email" type="email" required autoComplete="username" className={aInput} /></div>
          <div><label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" className={aInput} /></div>
          <Submit pendingText="Signing in…">Sign in</Submit>
        </form>
        <p className="mt-6 flex flex-wrap justify-between gap-3 text-sm"><Link href="/admin/forgot-password" className="inline-flex min-h-11 items-center underline underline-offset-4">Forgot your password?</Link><Link href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">← Back to website</Link></p>
      </div>
    </main>
  );
}
