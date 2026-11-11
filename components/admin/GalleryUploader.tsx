"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { uploadImage } from "./ImageField";
import { addGalleryImages } from "@/app/admin/(panel)/gallery/actions";

export function GalleryUploader({ categories = [] }: { categories?: string[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("general");
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    const done: { url: string; width: number; height: number }[] = []; const errors: string[] = [];
    for (const f of Array.from(files)) { try { done.push(await uploadImage(f, "gallery")); } catch (e) { errors.push(`${f.name}: ${(e as Error).message}`); } }
    if (done.length) { const r = await addGalleryImages(done, category); if (r.error) errors.push(r.error); }
    setMsg(`${done.length} photo${done.length === 1 ? "" : "s"} uploaded and live on the gallery.${done.length ? " Add a short description to each below for accessibility." : ""}${errors.length ? ` Problems: ${errors.join("; ")}` : ""}`);
    setBusy(false); if (ref.current) ref.current.value = ""; router.refresh();
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-deep">Category
          <input list="gallery-cats" value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-10 w-40 border border-[#dccfb8] bg-white px-2 text-sm" />
          <datalist id="gallery-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => ref.current?.click()}><ImagePlus size={16} />{busy ? "Uploading…" : "Upload photos"}</button>
      </div>
      <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" aria-label="Choose photos to upload" onChange={(e) => onFiles(e.target.files)} />
      {msg && <p role="status" className="mt-3 max-w-xl text-sm">{msg}</p>}
    </div>
  );
}
