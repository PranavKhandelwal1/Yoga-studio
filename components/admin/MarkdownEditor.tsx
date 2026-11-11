"use client";
import { useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

export function MarkdownEditor({ name, label, defaultValue, rows = 14 }: { name: string; label: string; defaultValue?: string | null; rows?: number }) {
  const [v, setV] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState(false);
  const html = useMemo(() => renderMarkdown(v), [v]);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={name} className="text-sm font-medium text-deep">{label}</label>
        <div className="flex gap-1 text-xs"><button type="button" onClick={() => setPreview(false)} aria-pressed={!preview} className={`px-2 py-1 ${!preview ? "bg-forest text-cream" : "hover:bg-sage/30"}`}>Write</button><button type="button" onClick={() => setPreview(true)} aria-pressed={preview} className={`px-2 py-1 ${preview ? "bg-forest text-cream" : "hover:bg-sage/30"}`}>Preview</button></div>
      </div>
      <textarea id={name} name={name} rows={rows} value={v} onChange={(e) => setV(e.target.value)} hidden={preview} className="w-full border border-[#dccfb8] bg-white px-3 py-2 font-mono text-sm" />
      {preview && <div className="prose-yoga min-h-40 border border-[#dccfb8] bg-white p-4" dangerouslySetInnerHTML={{ __html: html || "<p>Nothing to preview.</p>" }} />}
      <p className="mt-1 text-xs text-ink-soft">Markdown: # Heading, **bold**, *italic*, [link](https://…), - list, &gt; quote</p>
    </div>
  );
}
