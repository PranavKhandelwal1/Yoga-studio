import { NextResponse, type NextRequest } from "next/server";
import sharp, { type OutputInfo } from "sharp";
import { randomUUID } from "node:crypto";
import { assertAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/utils/origin";
import { sniffImage } from "@/lib/utils/image";

export const runtime = "nodejs";
const FOLDERS = ["homepage", "portraits", "classes", "retreats", "gallery", "blog"] as const;
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { await assertAdmin(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folder = String(form?.get("folder") ?? "gallery");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!(FOLDERS as readonly string[]).includes(folder)) return NextResponse.json({ error: "Invalid folder." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is larger than 10 MB." }, { status: 413 });

  const input = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(input)) return NextResponse.json({ error: "Only JPEG, PNG, WebP or AVIF images are allowed." }, { status: 415 });

  let out: { data: Buffer; info: OutputInfo };
  try {
    // Re-encode: strips metadata (incl. GPS), fixes orientation, caps size, converts to modern WebP.
    out = await sharp(input, { limitInputPixels: 80_000_000 }).rotate().resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch { return NextResponse.json({ error: "That file could not be processed as an image." }, { status: 422 }); }

  const db = await createClient();
  const path = `${folder}/${randomUUID()}.webp`;
  const { error } = await db.storage.from("media").upload(path, out.data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) return NextResponse.json({ error: "Upload failed. Check that Supabase Storage is set up." }, { status: 500 });
  const { data } = db.storage.from("media").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, width: out.info.width, height: out.info.height, path });
}
