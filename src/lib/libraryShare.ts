// Prepares any Library item for sharing: a link people can open and,
// where possible, the actual file for "Send the file".
//
// Items whose url is already an https storage/asset link just get a fresh
// 7-day signed link. Items stored as inline content (apps = raw HTML,
// text notes = raw text, some documents = data: links) are first uploaded
// to the member's own storage folder so the shared link is a real file
// that opens on any phone. Stories share their public story page instead.

import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl } from "@/lib/signedStorageUrl";
import { PUBLIC_ORIGIN, watchPageUrl } from "@/lib/sharedMedia";

export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SHARE_BUCKET = "photography-assets";

export interface PreparedShare {
  /** The link people receive. */
  linkUrl: string;
  /** Direct file link for "Send the file" (empty when there is no file). */
  fileUrl?: string;
  fileName: string;
}

export function libraryShareFileName(item: any): string {
  const base =
    String(item?.title || "oracle-lunar")
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "oracle-lunar";
  const path = String(item?._storedUrl || item?.url || "").split("?")[0];
  const ext =
    path.match(/\.([a-z0-9]{2,5})$/i)?.[1] ||
    (item?.media_type === "video"
      ? "mp4"
      : item?.media_type === "audio" || item?.media_type === "music"
        ? "mp3"
        : item?.media_type === "image"
          ? "png"
          : item?.media_type === "app"
            ? "html"
            : "txt");
  return `${base}.${ext}`;
}

/** Public story page link for story items, or null for other types. */
export function storyShareLink(item: any): string | null {
  if (item?.media_type !== "story") return null;
  const slug = String(item?.url || "").replace(/^oracle-lunar:\/\/story\//, "").trim();
  if (!slug) return null;
  return `${PUBLIC_ORIGIN}/stories/${encodeURIComponent(slug)}`;
}

/** Inline content (raw HTML apps, raw text notes, data: links) as a Blob. */
export function inlineShareBlob(item: any): Blob | null {
  const url = String(item?.url || "");
  if (!url) return null;
  if (item?.media_type === "app" || /^\s*<!doctype html|^\s*<html/i.test(url)) {
    return new Blob([url], { type: "text/html" });
  }
  if (item?.media_type === "text") {
    return new Blob([url], { type: "text/plain" });
  }
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;,]*)(;base64)?,(.*)$/s);
    if (!m) return null;
    const mime = m[1] || "text/plain";
    try {
      if (m[2]) {
        const bin = atob(m[3]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      }
      return new Blob([decodeURIComponent(m[3])], { type: mime });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Build the share link + sendable file for any Library item.
 * Throws when an inline item cannot be uploaded.
 */
export async function prepareLibraryShare(item: any, userId: string): Promise<PreparedShare> {
  const fileName = libraryShareFileName(item);

  // Stories share their public page; there is no file to send.
  const storyLink = storyShareLink(item);
  if (storyLink) return { linkUrl: storyLink, fileName };

  const raw = String(item?._storedUrl || item?.url || "");

  // Real https file: fresh 7-day link, played through the public watch page when possible.
  if (/^https:\/\//.test(raw)) {
    const signed = await resolveStorageUrl(raw, SHARE_TTL_SECONDS);
    const linkUrl = watchPageUrl(signed, item?.title || "Oracle Lunar", item?.media_type) || signed;
    return { linkUrl, fileUrl: signed, fileName };
  }

  // Inline content: upload to the member's own storage folder, then sign for 7 days.
  const blob = inlineShareBlob(item);
  if (!blob) {
    // Nothing better available — share whatever the item holds.
    return { linkUrl: raw || `${PUBLIC_ORIGIN}/`, fileName };
  }
  const path = `${userId}/library/shared/${crypto.randomUUID()}-${fileName}`;
  const { error } = await supabase.storage.from(SHARE_BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });
  if (error) throw new Error(error.message || "Upload failed");
  const { data, error: signError } = await supabase.storage
    .from(SHARE_BUCKET)
    .createSignedUrl(path, SHARE_TTL_SECONDS);
  if (signError || !data?.signedUrl) throw new Error(signError?.message || "Could not create share link");
  // Signed file links arrive labelled as plain text on phones, so the link
  // opens the public watch page which re-labels and shows the file.
  const linkUrl = watchPageUrl(data.signedUrl, item?.title || "Oracle Lunar", item?.media_type) || data.signedUrl;
  return { linkUrl, fileUrl: data.signedUrl, fileName };
}
