"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";

type Item = { title: string; description: string };
/** Day-by-day programme editor. Serialised as JSON in a hidden input. */
export function ProgrammeField({ name, defaultValue }: { name: string; defaultValue: Item[] }) {
  const [items, setItems] = useState<Item[]>(defaultValue ?? []);
  const set = (i: number, k: keyof Item, v: string) => setItems((x) => x.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="border border-[#dccfb8] bg-white p-3">
            <div className="flex gap-2">
              <input value={it.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="e.g. Day 1 — Arrival" aria-label={`Programme item ${i + 1} title`} className="w-full border border-[#dccfb8] px-2 py-1.5 text-sm" />
              <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="flex h-9 w-9 shrink-0 items-center justify-center hover:bg-sage/30"><X size={16} /></button>
            </div>
            <textarea value={it.description} onChange={(e) => set(i, "description", e.target.value)} rows={2} placeholder="Description" aria-label={`Programme item ${i + 1} description`} className="mt-2 w-full border border-[#dccfb8] px-2 py-1.5 text-sm" />
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => setItems((x) => [...x, { title: "", description: "" }])}><Plus size={15} />Add programme item</button>
    </div>
  );
}
