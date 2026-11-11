import type { Metadata } from "next";
import { SITE_URL } from "@/lib/utils/format";

export const SITE_NAME = "Be With Yoga";

export function buildMetadata(o: { title?: string | null; description?: string | null; path: string; image?: string | null; type?: "website" | "article"; noindex?: boolean }): Metadata {
  const title = o.title ?? undefined;
  const description = o.description ?? undefined;
  const url = `${SITE_URL}${o.path === "/" ? "" : o.path}`;
  return {
    title, description,
    alternates: { canonical: url },
    robots: o.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title: title ?? SITE_NAME, description, url, siteName: SITE_NAME, type: o.type ?? "website", locale: "en_GB", images: o.image ? [{ url: o.image }] : undefined },
    twitter: { card: o.image ? "summary_large_image" : "summary", title: title ?? SITE_NAME, description, images: o.image ? [o.image] : undefined },
  };
}

/** Safe JSON-LD serialisation (prevents </script> injection). */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
