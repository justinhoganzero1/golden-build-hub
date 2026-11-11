// Helpers for the members' Oracle video Library (owner-published clips).

export interface OracleClip {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  poster_url: string | null;
  duration_seconds: number | null;
  is_published: boolean;
  published_at: string;
}

export const ORACLE_CLIPS_BUCKET = "oracle-clips";

/** Site assets and full links play directly; anything else is a private storage path. */
export function clipSource(videoUrl: string): { kind: "direct"; url: string } | { kind: "storage"; path: string } {
  if (/^(https?:)?\/\//i.test(videoUrl) || videoUrl.startsWith("/")) return { kind: "direct", url: videoUrl };
  return { kind: "storage", path: videoUrl.replace(/^oracle-clips\//, "") };
}

/** A clip is "New" when it was published after the member last opened the Library. */
export function isNewClip(publishedAt: string, lastSeen: string | null): boolean {
  if (!lastSeen) return true;
  return new Date(publishedAt).getTime() > new Date(lastSeen).getTime();
}

export function clipFilename(title: string, ext = "mp4"): string {
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "oracle-lunar-clip";
  return `${base}.${ext}`;
}

export function formatClipLength(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const lastSeenKey = (userId: string) => `oracle-videos:last-seen:${userId}`;
