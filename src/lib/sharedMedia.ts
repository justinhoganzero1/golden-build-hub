// Library shares send people to a public player page on oraclelunar.com
// instead of a raw storage link, so phones show a playable video (first
// frame, play button) rather than a blank or downloading file.

export const PUBLIC_ORIGIN = "https://oraclelunar.com";
const STORAGE_HOST = "tpkpfkcnqdyrzpqdoqnp.supabase.co";

export type SharedKind = "video" | "audio" | "image" | "doc";

/** Only our own storage and asset links can be played on the watch page. */
export function isShareableMediaSource(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    if (u.hostname === STORAGE_HOST) return u.pathname.startsWith("/storage/v1/object/");
    if (u.hostname === "oraclelunar.com" || u.hostname === "www.oraclelunar.com") return u.pathname.startsWith("/__l5e/assets-v1/");
    return false;
  } catch {
    return false;
  }
}

export function sharedKind(mediaType: string | null | undefined): SharedKind | null {
  const t = String(mediaType || "").toLowerCase();
  if (t === "video" || t === "movie") return "video";
  if (t === "audio" || t === "music" || t === "voice") return "audio";
  if (t === "image" || t === "photo") return "image";
  // Apps (HTML), notes and documents open on the watch page as documents:
  // signed file links arrive as plain text on phones, so the page re-labels
  // and shows them instead.
  if (t === "app" || t === "text" || t === "document") return "doc";
  return null;
}

/** Public watch-page link for a Library file, or null when it can't be played there. */
export function watchPageUrl(src: string | null | undefined, title: string, mediaType: string | null | undefined): string | null {
  const kind = sharedKind(mediaType);
  if (!kind || !isShareableMediaSource(src)) return null;
  const q = new URLSearchParams({ type: kind, title: title.slice(0, 120), src: src as string });
  return `${PUBLIC_ORIGIN}/watch?${q.toString()}`;
}

const EXT_TYPES: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf", html: "text/html", txt: "text/plain",
};

/**
 * The real file type to attach when sending a file. Some saved files are stored
 * as "application/octet-stream", which phones receive as a blank, unplayable file.
 */
export function fileMimeType(fileName: string, served?: string | null): string {
  const clean = String(served || "").split(";")[0].trim().toLowerCase();
  const ext = fileName.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  const fromExt = ext ? EXT_TYPES[ext] : undefined;
  // Signed storage links often serve everything as octet-stream or plain
  // text, so a known file extension wins over those generic labels.
  if (fromExt && (!clean || clean === "application/octet-stream" || clean === "binary/octet-stream" || clean === "text/plain")) {
    return fromExt;
  }
  if (clean) return clean;
  return fromExt || "application/octet-stream";
}
