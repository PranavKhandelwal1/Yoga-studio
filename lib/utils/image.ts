/** Verify the file really is an image by its magic bytes — never trust the client's MIME type or filename. */
export function sniffImage(b: Buffer): "jpeg" | "png" | "webp" | "avif" | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (b.subarray(4, 8).toString("ascii") === "ftyp" && /^(avif|avis)$/.test(b.subarray(8, 12).toString("ascii"))) return "avif";
  return null;
}

