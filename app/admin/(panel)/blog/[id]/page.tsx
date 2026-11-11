import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminTitle, Badge, Flash } from "@/components/admin/ui";
import { Confirm } from "@/components/admin/Buttons";
import { PostForm } from "@/components/admin/PostForm";
import { createClient } from "@/lib/supabase/server";
import type { BlogCategory, BlogPost } from "@/types/db";
import { deletePost } from "../actions";
export const metadata = { title: "Edit article" };
export const dynamic = "force-dynamic";

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = await createClient();
  const [{ data: p }, { data: cats }] = await Promise.all([db.from("blog_posts").select("*").eq("id", id).maybeSingle(), db.from("blog_categories").select("*").order("name")]);
  if (!p) notFound();
  const live = p.status === "published" && p.published_at && new Date(p.published_at) <= new Date();
  return (
    <>
      <AdminTitle title={p.title} sub={`/journal/${p.slug}`}><Badge s={p.status} />{live && <Link href={`/journal/${p.slug}`} target="_blank" className="btn btn-outline btn-sm">View ↗</Link>}
        <form action={deletePost}><input type="hidden" name="id" value={id} /><Confirm message="Delete this article permanently?">Delete</Confirm></form></AdminTitle>
      <Flash ok={sp.ok} err={sp.err} />
      <PostForm p={p as BlogPost} categories={(cats ?? []) as BlogCategory[]} />
    </>
  );
}
