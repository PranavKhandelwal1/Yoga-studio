"use client";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { uploadImage } from "./ImageField";

type Item = { url: string; alt: string };
/** Multi-image list (e.g. retreat photos). Serialised as JSON in a hidden input. */
export function ImageListField({ name, label, defaultValue }: { name: string; label: string; defaultValue: Item[] }) {
  const [items, setItems] = useState<Item[]>(defaultValue ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    for (const f of Array.from(files)) {
      try { const r = await uploadImage(f, "retreats"); setItems((x) => [...x, { url: r.url, alt: "" }]); } catch (e) { setErr((e as Error).message); }
    }
    setBusy(false); if (input.current) input.current.value = "";
  }
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-deep">{label}</p>
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 border border-[#dccfb8] bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt="" className="h-20 w-24 shrink-0 object-cover" />
            <div className="min-w-0 flex-1"><input value={it.alt} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, alt: e.target.value } : y)))} placeholder="Alt text" aria-label={`Photo ${i + 1} alt text`} className="w-full border border-[#dccfb8] px-2 py-1.5 text-sm" /></div>
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center hover:bg-sage/30"><X size={16} /></button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-outline btn-sm mt-3" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={15} />{busy ? "Uploading…" : "Add photos"}</button>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" aria-label={`${label}: choose files`} onChange={(e) => onFiles(e.target.files)} />
      {err && <p role="alert" className="mt-2 text-xs text-[#8c2f2f]">{err}</p>}
    </div>
  );
}
