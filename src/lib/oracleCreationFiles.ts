// Stores files Oracle creates (music, sound effects, narrations) in the member's
// own private storage folder and returns a permanent storage reference, so the
// Library row stays small and the file keeps working after signed links expire.
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "photography-assets";

export function creationFileName(label: string, ext: string): string {
  const base = String(label || "creation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "creation";
  return `${base}.${ext.replace(/[^a-z0-9]/gi, "") || "bin"}`;
}

/** Permanent (authenticated) storage URL — signed on open by resolveStorageUrl. */
export function storageObjectUrl(path: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Uploads into <userId>/library/oracle/… and returns the permanent URL, or null on failure. */
export async function uploadCreationFile(blob: Blob, userId: string, label: string, ext: string): Promise<string | null> {
  if (!userId || !blob?.size) return null;
  const path = `${userId}/library/oracle/${crypto.randomUUID()}-${creationFileName(label, ext)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
  if (error) { console.error("Oracle creation upload failed", error.message); return null; }
  return storageObjectUrl(path);
}

// ── Videos still being made when the member leaves: resume them later ──
// Only the saved job ID is polled again (never a new generation), so nothing is paid twice.
const pendingKey = (userId: string) => `oracle-lunar:pending-videos:${userId}`;
export interface PendingVideo { jobId: string; prompt: string; at: number }

export function rememberPendingVideo(userId: string, jobId: string, prompt: string) {
  if (!userId || !jobId) return;
  try {
    const list = listPendingVideos(userId).filter((p) => p.jobId !== jobId);
    list.push({ jobId, prompt: prompt.slice(0, 200), at: Date.now() });
    localStorage.setItem(pendingKey(userId), JSON.stringify(list.slice(-10)));
  } catch { /* storage full or blocked */ }
}

export function listPendingVideos(userId: string): PendingVideo[] {
  try {
    const raw = JSON.parse(localStorage.getItem(pendingKey(userId)) || "[]");
    const weekAgo = Date.now() - 7 * 86400_000;
    return Array.isArray(raw) ? raw.filter((p) => p && typeof p.jobId === "string" && typeof p.at === "number" && p.at > weekAgo) : [];
  } catch { return []; }
}

export function forgetPendingVideo(userId: string, jobId: string) {
  try {
    localStorage.setItem(pendingKey(userId), JSON.stringify(listPendingVideos(userId).filter((p) => p.jobId !== jobId)));
  } catch { /* ignore */ }
}
