import { describe, expect, it } from "vitest";
import { madridDateKey, madridLocalToUtc, fmtTime } from "@/lib/utils/time";
import { addDays, monthGrid, startOfWeek } from "@/lib/utils/calendar";
import { csvCell, toCsv } from "@/lib/utils/csv";
import { htmlToMarkdown } from "@/lib/utils/html-to-md";
import { sniffImage } from "@/lib/utils/image";
import { sameOrigin } from "@/lib/utils/origin";
import { formatPrice, slugify } from "@/lib/utils/format";
import { renderMarkdown } from "@/lib/markdown";
import type { NextRequest } from "next/server";

describe("Mallorca time", () => {
  it("summer 18:00 Madrid is 16:00 UTC (CEST)", () => expect(madridLocalToUtc("2027-07-05", "18:00").toISOString()).toBe("2027-07-05T16:00:00.000Z"));
  it("winter 18:00 Madrid is 17:00 UTC (CET)", () => expect(madridLocalToUtc("2027-01-11", "18:00").toISOString()).toBe("2027-01-11T17:00:00.000Z"));
  it("round-trips across the spring DST change (28 Mar 2027)", () => {
    for (const d of ["2027-03-27", "2027-03-28", "2027-03-29"]) { const u = madridLocalToUtc(d, "10:00"); expect(madridDateKey(u)).toBe(d); expect(fmtTime(u)).toBe("10:00"); }
  });
  it("a late-evening UTC instant is the next day in Madrid", () => expect(madridDateKey("2027-06-30T22:30:00Z")).toBe("2027-07-01"));
});

describe("calendar", () => {
  it("weeks start on Monday", () => expect(startOfWeek("2027-06-09")).toBe("2027-06-07"));
  it("addDays crosses months", () => expect(addDays("2027-01-31", 1)).toBe("2027-02-01"));
  it("month grid is whole weeks and contains the month", () => { const g = monthGrid("2027-02-10"); expect(g.length % 7).toBe(0); expect(g).toContain("2027-02-28"); expect(g[0]).toBe("2027-02-01"); });
});

describe("csv", () => {
  it("quotes commas/quotes/newlines", () => expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"'));
  it("neutralises spreadsheet formulas", () => { expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)"); expect(csvCell("+34600")).toBe("'+34600"); });
  it("builds rows", () => expect(toCsv([["a", "b"], [1, null]])).toBe("a,b\r\n1,\r\n"));
});

describe("html → markdown", () => {
  it("converts common WordPress markup", () => {
    const md = htmlToMarkdown('<p>Hello <strong>world</strong> &amp; <a href="https://x.y">link</a></p><h3>Title</h3><ul><li>One</li><li>Two</li></ul><blockquote><p>Quote</p></blockquote><img src="https://a.b/c.jpg?w=300" alt="pic">');
    expect(md).toContain("Hello **world** & [link](https://x.y)"); expect(md).toContain("### Title"); expect(md).toContain("- One\n- Two"); expect(md).toContain("> Quote"); expect(md).toContain("![pic](https://a.b/c.jpg)");
  });
  it("drops scripts", () => expect(htmlToMarkdown("<p>a</p><script>alert(1)</script>")).toBe("a"));
});

describe("markdown rendering is XSS-safe", () => {
  it("escapes raw HTML and blocks javascript: links", () => {
    const html = renderMarkdown('<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<script/i); expect(html).not.toMatch(/href="javascript:/i); expect(html).not.toMatch(/<img[^>]*onerror/i);
  });
});

describe("upload & CSRF guards", () => {
  it("detects real images by magic bytes and rejects disguised files", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpeg");
    expect(sniffImage(Buffer.from("<?php echo 1; ?>padding"))).toBeNull();
    expect(sniffImage(Buffer.from("<svg onload=alert(1)></svg>"))).toBeNull();
  });
  const req = (origin: string | null, host = "bewithyoga.live") => ({ headers: new Headers({ ...(origin ? { origin } : {}), host }) }) as unknown as NextRequest;
  it("accepts same-origin and rejects cross-origin posts", () => { expect(sameOrigin(req("https://bewithyoga.live"))).toBe(true); expect(sameOrigin(req("https://evil.example"))).toBe(false); expect(sameOrigin(req("not a url"))).toBe(false); });
});

describe("formatting", () => {
  it("formats euros", () => { expect(formatPrice(1500)).toContain("15"); expect(formatPrice(null)).toBe("Price on request"); });
  it("slugifies accents", () => expect(slugify("Retiro de Yoga — Mallorca ¡2027!")).toBe("retiro-de-yoga-mallorca-2027"));
});
