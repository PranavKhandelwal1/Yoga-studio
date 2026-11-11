import { AdminTitle, Card, Flash, TextIn } from "@/components/admin/ui";
import { Submit } from "@/components/admin/Buttons";
import { SETTINGS_SCHEMA } from "@/lib/content/schema";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS } from "@/lib/content/defaults";
import { saveSettings } from "../content/actions";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const db = await createClient();
  const { data } = await db.from("site_settings").select("key,value");
  const saved = new Map((data ?? []).map((r) => [r.key, r.value as Record<string, string>]));
  return (
    <>
      <AdminTitle title="Settings" sub="Contact details, social links and site-wide text." />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="space-y-6">
        {Object.entries(SETTINGS_SCHEMA).map(([group, g]) => {
          const v = { ...((DEFAULT_SETTINGS as unknown as Record<string, Record<string, string>>)[group] ?? {}), ...(saved.get(group) ?? {}) };
          return (
            <Card key={group} title={g.label}>
              <form action={saveSettings} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="group" value={group} />
                {g.fields.map((f) => <TextIn key={f.key} label={f.label} name={f.key} defaultValue={v[f.key]} className={f.type === "textarea" ? "md:col-span-2" : undefined} />)}
                <div className="md:col-span-2"><Submit>Save {g.label.toLowerCase()}</Submit></div>
              </form>
            </Card>
          );
        })}
        <p className="text-sm text-ink-soft">Booking notification emails go to <code>ADMIN_NOTIFICATION_EMAIL</code> (server environment variable).</p>
      </div>
    </>
  );
}
