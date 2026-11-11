/** Uploads in our own Supabase Storage bucket are already resized + WebP-encoded by the upload endpoint. */
export const isStorageUrl = (src: unknown) => typeof src === "string" && src.includes("/storage/v1/object/public/");
