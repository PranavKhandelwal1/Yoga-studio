"use client";
import { Lotus } from "@/components/ui/YogaIcons";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { isStorageUrl } from "@/lib/utils/image-src";

/**
 * next/image with a graceful fallback: if the source can't be loaded, show a clearly-marked
 * replaceable placeholder instead of a broken icon (never pretends to be a real photograph).
 */
export function SmartImage({ alt, className, ...props }: ImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed || !props.src) {
    return (
      <div role="img" aria-label={`${alt} (image to be replaced)`} className={`flex items-center justify-center bg-sage/30 text-center text-xs uppercase tracking-[0.2em] text-forest ${className ?? ""}`}
        style={props.fill ? { position: "absolute", inset: 0 } : { width: props.width, height: props.height }}>
        <span className="flex flex-col items-center gap-3 px-4"><Lotus size={34} className="text-gold" /><span>Photo to be added</span></span>
      </div>
    );
  }
  // Admin uploads are served straight from Supabase Storage (already optimised WebP, long-cached), so they never
  // depend on the Next.js image optimiser / allow-list. Everything else still goes through next/image.
  return <Image {...props} alt={alt} className={className} unoptimized={props.unoptimized ?? isStorageUrl(props.src)} onError={() => setFailed(true)} />;
}
