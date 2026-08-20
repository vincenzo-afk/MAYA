import { getSupabaseServerClient } from "./supabaseConfig";

const MAYA_MEDIA_BUCKET = "maya-media";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function toBlob(data: Buffer | Uint8Array | string, contentType: string): Blob {
  if (typeof data === "string") return new Blob([data], { type: contentType });
  return new Blob([data as unknown as BlobPart], { type: contentType });
}

/** Stores private companion media in Supabase Storage behind Maya's existing protected media route. */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const { error } = await getSupabaseServerClient().storage.from(MAYA_MEDIA_BUCKET).upload(
    key,
    toBlob(data, contentType),
    { contentType, cacheControl: "3600", upsert: false },
  );

  if (error) throw new Error(`Supabase media upload failed: ${error.message}`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const { data, error } = await getSupabaseServerClient().storage.from(MAYA_MEDIA_BUCKET).createSignedUrl(key, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Supabase media signed URL failed: ${error?.message ?? "empty response"}`);
  }
  return data.signedUrl;
}
