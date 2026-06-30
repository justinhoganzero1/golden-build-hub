// Utility helpers for resolving Supabase Storage URLs that may need a signed URL
// (private buckets) instead of the raw `/object/public/...` CDN URL.
//
// Public buckets in this project: site-assets, app-downloads.
// Private buckets (require signed URLs for non-owners): photography-assets, movies, living-gifs.
import { supabase } from "@/integrations/supabase/client";

const PRIVATE_BUCKETS = new Set(["photography-assets", "movies", "living-gifs"]);
const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour

export interface ParsedStorageUrl {
  bucket: string;
  path: string;
  isPublic: boolean; // whether the URL was the `/object/public/...` form
}

/** Extract bucket + object path from any Supabase storage URL. Returns null for non-storage URLs. */
export function parseStorageUrl(url: string | null | undefined): ParsedStorageUrl | null {
  if (!url || typeof url !== "string") return null;
  // /storage/v1/object/public/<bucket>/<path...>
  // /storage/v1/object/sign/<bucket>/<path...>?token=...
  // /storage/v1/object/<bucket>/<path...>
  const m = url.match(/\/storage\/v1\/object\/(?:(public|sign|authenticated)\/)?([^/?#]+)\/([^?#]+)/);
  if (!m) return null;
  const kind = m[1];
  const bucket = decodeURIComponent(m[2]);
  const path = decodeURIComponent(m[3]);
  return { bucket, path, isPublic: kind === "public" };
}

export function isPrivateStorageBucket(bucket: string): boolean {
  return PRIVATE_BUCKETS.has(bucket);
}

/**
 * Resolve a storage URL to a usable URL.
 * - Non-storage URLs (external CDN, data:, blob:) are returned as-is.
 * - Public-bucket URLs are returned as-is.
 * - Private-bucket URLs are converted to a signed URL.
 * Returns the original URL as a fallback if signing fails.
 */
export async function resolveStorageUrl(
  url: string | null | undefined,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  if (!url) return "";
  const parsed = parseStorageUrl(url);
  if (!parsed) return url; // not a Supabase storage URL
  if (!isPrivateStorageBucket(parsed.bucket)) return url; // public bucket
  try {
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, ttlSeconds);
    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
}
