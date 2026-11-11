import { AdminTitle, Flash } from "@/components/admin/ui";
import { ClassForm } from "@/components/admin/ClassForm";
import { madridDateKey } from "@/lib/utils/time";
export const metadata = { title: "New class" };
export const dynamic = "force-dynamic";
export default async function NewClass({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return (<><AdminTitle title="New class" /><Flash ok={sp.ok} err={sp.err} /><ClassForm today={madridDateKey(new Date())} /></>);
}
