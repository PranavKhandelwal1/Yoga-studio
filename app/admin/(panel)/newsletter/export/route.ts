import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { await assertAdmin(); } catch { return new NextResponse("Unauthorized", { status: 401 }); }
  const status = new URL(req.url).searchParams.get("status");
  const db = await createClient();
  // Supabase returns at most 1,000 rows per request, so read the list page by page — a single query would silently cut the export off.
  type Row = { email: string; status: string; source: string | null; subscribed_at: string; unsubscribed_at: string | null };
  const data: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("newsletter_subscribers").select("email,status,source,subscribed_at,unsubscribed_at").order("subscribed_at", { ascending: false }).order("id").range(from, from + 999);
    if (status === "subscribed" || status === "unsubscribed") q = q.eq("status", status);
    const { data: page, error } = await q;
    if (error) return new NextResponse("Export failed", { status: 500 });
    data.push(...((page ?? []) as Row[]));
    if ((page?.length ?? 0) < 1000) break;
  }
  const csv = toCsv([["email", "status", "source", "subscribed_at", "unsubscribed_at"], ...data.map((r) => [r.email, r.status, r.source, r.subscribed_at, r.unsubscribed_at])]);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
