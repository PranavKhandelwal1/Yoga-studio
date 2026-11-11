import { escapeHtml } from "@/lib/utils/format";

/**
 * Small, safe Markdown → HTML renderer for journal articles and long text.
 * All input is HTML-escaped FIRST, so no raw HTML / script can ever pass through.
 * Supports: # headings, paragraphs, **bold**, *italic*, [links](https://…), - lists, 1. lists, > quotes, ---.
 */
function inline(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+)\)/g,
    (_m, label, href) => `<a href="${href}"${href.startsWith("/") ? "" : ' rel="noopener noreferrer nofollow" target="_blank"'}>${label}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  return t;
}

export function renderMarkdown(src: string): string {
  const lines = (src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.type}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.+)$/))) { flushPara(); flushList(); const lvl = Math.min(m[1].length + 1, 4); out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushPara(); flushList(); out.push("<hr>"); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`); continue; }
    if ((m = line.match(/^[-*]\s+(.+)$/))) { flushPara(); if (list?.type !== "ul") { flushList(); list = { type: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.+)$/))) { flushPara(); if (list?.type !== "ol") { flushList(); list = { type: "ol", items: [] }; } list.items.push(m[1]); continue; }
    flushList(); para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join("\n");
}

export function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220));
}
