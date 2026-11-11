"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

export type Folder = "homepage" | "portraits" | "classes" | "retreats" | "gallery" | "blog";

export async function uploadImage(file: File, folder: Folder): Promise<{ url: string; width: number; height: number }> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Image is larger than 10 MB.");
  const fd = new FormData(); fd.set("file", file); fd.set("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed.");
  return data;
}

/** Image picker: uploads via the secure server endpoint, stores the resulting URL in a hidden input. */
export function ImageField({ name, label, folder, defaultValue, altName, altDefault }: { name: string; label: string; folder: Folder; defaultValue?: string | null; altName?: string; altDefault?: string | null }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function onFile(f?: File) {
    if (!f) return;
    setBusy(true); setErr(null);
    try { setUrl((await uploadImage(f, folder)).url); } catch (e) { setErr((e as Error).message); }
    setBusy(false); if (input.current) input.current.value = "";
  }
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-deep">{label}</p>
      <div className="flex flex-wrap items-start gap-4 border border-[#dccfb8] bg-white p-3">
        <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden bg-sage/20 text-xs text-ink-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : "No image"}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input type="hidden" name={name} value={url} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={15} />{busy ? "Uploading…" : url ? "Replace" : "Upload"}</button>
            {url && <button type="button" className="btn btn-outline btn-sm" onClick={() => setUrl("")}><Trash2 size={15} />Remove</button>}
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" aria-label={`${label}: choose file`} onChange={(e) => onFile(e.target.files?.[0])} />
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an image URL" aria-label={`${label} URL`} className="w-full border border-[#dccfb8] px-2 py-1.5 text-xs" />
          {altName && <input type="text" name={altName} defaultValue={altDefault ?? ""} placeholder="Describe the image (alt text, for accessibility & SEO)" aria-label={`${label} alt text`} className="w-full border border-[#dccfb8] px-2 py-1.5 text-sm" />}
          {err && <p role="alert" className="text-xs text-[#8c2f2f]">{err}</p>}
        </div>
      </div>
    </div>
  );
}
