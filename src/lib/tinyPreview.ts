// Tiny YouTube-style preview pictures for Library tiles.
//
// New pictures and videos get a very low-res JPEG snapshot (about 240px wide)
// stored on the Library row, so tiles show what is inside without loading the
// full file. Items saved before TINY_PREVIEW_START are left untouched.
import { resolveStorageUrl } from "@/lib/signedStorageUrl";

export const TINY_PREVIEW_START = "2026-11-18T02:30:00Z";
export const TINY_PREVIEW_SIZE = 240;
export const TINY_PREVIEW_MAX_CHARS = 60_000;
const QUALITY = 0.5;

export type TinyPreviewKind = "image" | "video";

export function tinyPreviewKind(mediaType: string | null | undefined): TinyPreviewKind | null {
  if (mediaType === "image" || mediaType === "gif") return "image";
  if (mediaType === "video") return "video";
  return null;
}

/** Only pictures/videos saved from TINY_PREVIEW_START onward get a snapshot. */
export function wantsTinyPreview(item: { media_type?: string | null; created_at?: string | null }): boolean {
  if (!tinyPreviewKind(item.media_type)) return false;
  const created = item.created_at ? Date.parse(item.created_at) : Date.now();
  if (!Number.isFinite(created)) return false;
  return created >= Date.parse(TINY_PREVIEW_START);
}

let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((r) => waiting.push(r));
  active++;
  try { return await job(); } finally { active--; waiting.shift()?.(); }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("preview timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function drawSmall(source: CanvasImageSource, width: number, height: number, size: number): string {
  const scale = Math.min(1, size / Math.max(width || size, height || size));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((width || size) * scale));
  canvas.height = Math.max(1, Math.round((height || size) * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

async function imageSnapshot(url: string, size: number): Promise<string> {
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image failed"));
    img.src = url;
  });
  return drawSmall(img, img.naturalWidth, img.naturalHeight, size);
}

function once(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error("video failed")); };
    const cleanup = () => { el.removeEventListener(event, ok); el.removeEventListener("error", bad); };
    el.addEventListener(event, ok);
    el.addEventListener("error", bad);
  });
}

async function videoSnapshot(url: string, size: number): Promise<string> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  try {
    const ready = once(video, "loadeddata");
    video.src = url;
    await ready;
    const d = Number.isFinite(video.duration) ? video.duration : 0;
    // A moment in, like YouTube — skips black opening frames.
    const at = d > 0 ? Math.min(1.5, d / 3) : 0.1;
    const seeked = once(video, "seeked");
    video.currentTime = at;
    await seeked;
    return drawSmall(video, video.videoWidth, video.videoHeight, size);
  } finally {
    video.removeAttribute("src");
    try { video.load(); } catch { /* ignore */ }
  }
}

/** Make a small JPEG data URL snapshot of a picture or video, or null. */
export async function makeTinyPreview(
  url: string | null | undefined,
  kind: TinyPreviewKind,
  size: number = TINY_PREVIEW_SIZE,
): Promise<string | null> {
  if (!url || typeof window === "undefined") return null;
  try {
    const playable = await resolveStorageUrl(url);
    const out = await slot(() => withTimeout(
      kind === "video" ? videoSnapshot(playable, size) : imageSnapshot(playable, size),
      kind === "video" ? 20_000 : 12_000,
    ));
    return out && out.startsWith("data:image/") && out.length < TINY_PREVIEW_MAX_CHARS ? out : null;
  } catch {
    return null;
  }
}
