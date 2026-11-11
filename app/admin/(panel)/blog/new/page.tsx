import { AdminTitle, Flash } from "@/components/admin/ui";
import { PostForm } from "@/components/admin/PostForm";
import { createClient } from "@/lib/supabase/server";
import type { BlogCategory } from "@/types/db";
export const metadata = { title: "New article" };
export default async function NewPost({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { data } = await (await createClient()).from("blog_categories").select("*").order("name");
  return (<><AdminTitle title="New article" /><Flash ok={sp.ok} err={sp.err} /><PostForm categories={(data ?? []) as BlogCategory[]} /></>);
}
