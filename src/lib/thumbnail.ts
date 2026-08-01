// Tiny, fast previews for library grids.
//
// Full-size library artwork is often several megabytes (8K renders, data URLs),
// which makes a picker grid crawl. These helpers produce a *very* low-res
// preview — server-side transform for Supabase Storage objects, canvas
// downscale for data/blob/remote URLs — and memoise the result so scrolling
// back through the grid is instant.
import { supabase } from "@/integrations/supabase/client";
import { parseStorageUrl } from "@/lib/signedStorageUrl";

const MEM = new Map<string, string>();
const CACHE_PREFIX = "og_thumb_v1::";
const DEFAULT_SIZE = 160; // px on the long edge — plenty for a grid tile
const DEFAULT_QUALITY = 35;

function cacheKey(url: string, size: number) {
  // Data URLs are far too long to use as a storage key.
  const head = url.slice(0, 48);
  const tail = url.slice(-48);
  return `${CACHE_PREFIX}${size}::${url.length}::${head}::${tail}`;
}

function readCache(key: string): string | null {
  const mem = MEM.get(key);
  if (mem) return mem;
  try {
    const v = sessionStorage.getItem(key);
    if (v) MEM.set(key, v);
    return v;
  } catch { return null; }
}

function writeCache(key: string, value: string) {
  MEM.set(key, value);
  try { sessionStorage.setItem(key, value); } catch { /* quota — memory cache still helps */ }
}

/** Downscale any loadable image URL to a small JPEG data URL via canvas. */
async function canvasThumb(url: string, size: number): Promise<string> {
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("thumb load failed"));
  });
  img.src = url;
  await loaded;
  const scale = Math.min(1, size / Math.max(img.naturalWidth || size, img.naturalHeight || size));
  const w = Math.max(1, Math.round((img.naturalWidth || size) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || size) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", DEFAULT_QUALITY / 100);
}

/**
 * Return a low-resolution preview URL for a tile face.
 * Falls back to the original URL if a thumbnail cannot be produced.
 */
export async function getThumbnailUrl(
  url: string | null | undefined,
  size: number = DEFAULT_SIZE,
): Promise<string> {
  if (!url) return "";
  if (url.startsWith("data:image/") && url.length < 40_000) return url; // already tiny

  const key = cacheKey(url, size);
  const cached = readCache(key);
  if (cached) return cached;

  const parsed = parseStorageUrl(url);
  if (parsed) {
    // Storage can resize server-side — no big bytes ever hit the browser.
    try {
      const { data } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, 60 * 60, {
          transform: { width: size, height: size, resize: "cover", quality: DEFAULT_QUALITY },
        });
      if (data?.signedUrl) {
        writeCache(key, data.signedUrl);
        return data.signedUrl;
      }
    } catch { /* fall through to canvas */ }
  }

  try {
    const thumb = await canvasThumb(url, size);
    writeCache(key, thumb);
    return thumb;
  } catch {
    return url;
  }
}
