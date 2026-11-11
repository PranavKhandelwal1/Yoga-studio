import { AdminTitle, Flash } from "@/components/admin/ui";
import { RetreatForm } from "@/components/admin/RetreatForm";
export const metadata = { title: "New retreat" };
export default async function NewRetreat({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return (<><AdminTitle title="New retreat" /><Flash ok={sp.ok} err={sp.err} /><RetreatForm /></>);
}
