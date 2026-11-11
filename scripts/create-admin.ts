/**
 * Creates (or promotes) an administrator. Run ONCE from your machine — there is no public admin sign-up.
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run create:admin
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (service key stays on your machine).
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(), password = process.env.ADMIN_PASSWORD;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
  if (password.length < 12) throw new Error("Use a password of at least 12 characters.");

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  let id: string | undefined;
  const created = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) {
    if (!/already|registered|exists/i.test(created.error.message)) throw created.error;
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    id = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!id) throw new Error("User exists but could not be located.");
    await sb.auth.admin.updateUserById(id, { password });
  } else id = created.data.user.id;

  const { error } = await sb.from("profiles").upsert({ id, email, role: "admin" }, { onConflict: "id" });
  if (error) throw error;
  console.log(`✓ ${email} is now an administrator. Sign in at /admin/login`);
}

main().catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exit(1); });
