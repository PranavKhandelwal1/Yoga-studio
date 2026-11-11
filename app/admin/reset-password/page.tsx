import type { Metadata } from "next";
import { updatePassword } from "../actions";
import { Flash, aInput } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default async function Reset({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md border border-sage/60 bg-white p-8 md:p-10">
        <h1 className="font-serif text-4xl text-deep">New password</h1>
        <div className="mt-6"><Flash err={sp.err} /></div>
        <form action={updatePassword} className="space-y-5">
          <div><label htmlFor="password" className="mb-1 block text-sm font-medium">New password (min. 12 characters)</label><input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className={aInput} /></div>
          <div><label htmlFor="confirm" className="mb-1 block text-sm font-medium">Confirm password</label><input id="confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password" className={aInput} /></div>
          <Submit>Update password</Submit>
        </form>
      </div>
    </main>
  );
}
