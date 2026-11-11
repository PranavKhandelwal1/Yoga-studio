/** Minimal, dependency-free HTML → Markdown for WordPress post bodies (used by scripts/migrate-wordpress.ts). */
const ent = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘").replace(/&#8220;/g, "“").replace(/&#8221;/g, "”").replace(/&#8211;/g, "–").replace(/&#8212;/g, "—").replace(/&hellip;/g, "…");

export function htmlToMarkdown(html: string): string {
  let s = html.replace(/\r/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/i)?.[1]; if (!src) return "";
    const alt = tag.match(/\balt="([^"]*)"/i)?.[1] ?? "";
    return `\n\n![${alt}](${src.split("?")[0]})\n\n`;
  });
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, l, t) => `\n\n${"#".repeat(Math.max(2, Number(l)))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`);
  s = s.replace(/<a [^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, t) => `[${t.replace(/<[^>]+>/g, "").trim()}](${href})`);
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**").replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*");
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, t) => "\n\n" + t.replace(/<[^>]+>/g, "").trim().split("\n").map((l: string) => `> ${l.trim()}`).join("\n") + "\n\n");
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, t) => `\n- ${t.replace(/<[^>]+>/g, "").trim()}`).replace(/<\/?(ul|ol)[^>]*>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "  \n").replace(/<hr\s*\/?>/gi, "\n\n---\n\n").replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  return ent(s).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
