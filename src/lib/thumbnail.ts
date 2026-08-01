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

/** Limit how many heavy thumbnail jobs run at once — 60 tiles at once stalls the tab. */
let active = 0;
const queue: (() => void)[] = [];
const MAX_PARALLEL = 6;

function acquire(): Promise<void> {
  if (active < MAX_PARALLEL) { active++; return Promise.resolve(); }
  return new Promise(resolve => queue.push(() => { active++; resolve(); }));
}
function release() {
  active--;
  const next = queue.shift();
  if (next) next();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("thumb timeout")), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/** True when the URL actually renders (transform endpoints can 400 silently). */
function probe(url: string, ms = 6000): Promise<boolean> {
  return new Promise(resolve => {
    const img = new window.Image();
    const done = (ok: boolean) => { clearTimeout(t); img.onload = img.onerror = null; resolve(ok); };
    const t = setTimeout(() => done(false), ms);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
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
    let plain = "";
    try {
      // Try the server-side resize first (no big bytes hit the browser).
      const [{ data: tr }, { data: raw }] = await Promise.all([
        supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60, {
          transform: { width: size, height: size, resize: "cover", quality: DEFAULT_QUALITY },
        }),
        supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60),
      ]);
      plain = raw?.signedUrl || "";
      if (tr?.signedUrl && await probe(tr.signedUrl)) {
        writeCache(key, tr.signedUrl);
        return tr.signedUrl;
      }
    } catch { /* fall through */ }
    // Image transformations unavailable → use the plain signed URL directly.
    if (plain) {
      writeCache(key, plain);
      return plain;
    }
  }

  await acquire();
  try {
    const thumb = await withTimeout(canvasThumb(url, size), 12_000);
    writeCache(key, thumb);
    return thumb;
  } catch {
    return url;
  } finally {
    release();
  }
}

