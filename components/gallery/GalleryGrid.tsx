"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";

export type GItem = { id: string; url: string; alt: string; caption: string | null; category: string; width: number | null; height: number | null };
const label = (c: string) => c.replace(/[-_]/g, " ").replace(/^\w/, (m) => m.toUpperCase());

export function GalleryGrid({ items, filters = true }: { items: GItem[]; filters?: boolean }) {
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const cats = useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort(), [items]);
  const shown = useMemo(() => (cat === "all" ? items : items.filter((i) => i.category === cat)), [items, cat]);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const move = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + shown.length) % shown.length)), [shown.length]);
  useEffect(() => {
    if (open === null) return;
    lastFocus.current = document.activeElement as HTMLElement;
    closeBtn.current?.focus();
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") move(1); if (e.key === "ArrowLeft") move(-1); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; lastFocus.current?.focus(); };
  }, [open, move]);

  if (items.length === 0) return <p className="text-ink-soft">Photographs will appear here soon.</p>;
  const cur = open !== null ? shown[open] : null;

  return (
    <div>
      {filters && cats.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter photographs by category">
          {["all", ...cats].map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
              className={`min-h-11 border px-4 text-[0.8125rem] transition-colors ${cat === c ? "border-deep bg-deep text-cream" : "border-line text-charcoal hover:bg-sage/30"}`}>{c === "all" ? "All" : label(c)}</button>
          ))}
        </div>
      )}
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4">
        {shown.map((it, i) => (
          <li key={it.id} className="break-inside-avoid">
            <button type="button" onClick={() => setOpen(i)} className="group relative block w-full overflow-hidden bg-sage/20" aria-label={`Open photograph: ${it.alt || "gallery image"}`}>
              {/* Each photo keeps its own proportions (portrait, landscape, square) — the masonry columns do the rest. */}
              <SmartImage src={it.url} alt={it.alt} width={it.width ?? 1200} height={it.height ?? 800} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                loading={i < 3 ? "eager" : "lazy"} style={{ height: "auto" }} className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.03]" />
            </button>
          </li>
        ))}
      </ul>
      {cur && (
        <div role="dialog" aria-modal="true" aria-label="Photograph viewer" className="fixed inset-0 z-50 flex items-center justify-center bg-deep/95 p-4" onClick={() => setOpen(null)}>
          <button ref={closeBtn} aria-label="Close" onClick={() => setOpen(null)} className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center text-cream hover:bg-cream/10"><X size={28} /></button>
          {shown.length > 1 && <>
            <button aria-label="Previous photograph" onClick={(e) => { e.stopPropagation(); move(-1); }} className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-cream hover:bg-cream/10"><ChevronLeft size={32} /></button>
            <button aria-label="Next photograph" onClick={(e) => { e.stopPropagation(); move(1); }} className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-cream hover:bg-cream/10"><ChevronRight size={32} /></button>
          </>}
          <figure className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <SmartImage src={cur.url} alt={cur.alt} width={cur.width ?? 1600} height={cur.height ?? 1200} sizes="100vw" style={{ width: "auto", height: "auto" }} className="max-h-[82vh] max-w-full object-contain" priority />
            {(cur.caption || cur.alt) && <figcaption className="mt-3 text-center text-sm text-cream/85">{cur.caption || cur.alt}</figcaption>}
          </figure>
        </div>
      )}
    </div>
  );
}
