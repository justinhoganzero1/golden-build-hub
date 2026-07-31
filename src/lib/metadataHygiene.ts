/**
 * Privacy-only metadata hygiene.
 *
 * Purpose: remove PRIVACY-SENSITIVE identifiers (GPS coordinates, camera/device
 * serials, account ids, emails, local file paths) from anything the user
 * exports.
 *
 * NON-NEGOTIABLE: provenance is preserved. We never strip or hide the fact
 * that content was created with AI assistance — the "Created with Oracle Lunar"
 * credit and the AI-assistance declaration are re-attached on every export.
 */

export interface ProvenanceInfo {
  title: string;
  author: string;
  createdAt?: string;
  tool?: string;
  aiAssisted?: boolean;
  humanEditedPercent?: number;
}

/** Human-readable provenance block that MUST stay attached to exports. */
export function provenanceBlock(info: ProvenanceInfo): string {
  const when = info.createdAt || new Date().toISOString();
  return [
    "-- PROVENANCE (do not remove) --",
    `Title: ${info.title || "Untitled"}`,
    `Author / rights holder: ${info.author || "Unknown"}`,
    `Created with: ${info.tool || "Oracle Lunar"}`,
    `Created at: ${when}`,
    `AI assistance: ${info.aiAssisted === false ? "none declared" : "yes — AI-assisted generation and/or editing"}`,
    typeof info.humanEditedPercent === "number"
      ? `Human-edited content: ${info.humanEditedPercent.toFixed(1)}% of the final manuscript`
      : "",
    "Privacy note: GPS, device and account identifiers were removed from this export. Provenance was intentionally kept intact.",
  ]
    .filter(Boolean)
    .join("\n");
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const PATH_RE = /(?:[A-Za-z]:\\|\/(?:Users|home)\/)[^\s"'<>]+/g;
const COORD_RE = /\b-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IMEI_RE = /\b(?:IMEI|serial|Serial|SN)[:\s#]*[A-Za-z0-9-]{6,}\b/g;

/**
 * Scrub privacy identifiers out of free text that is about to be written into
 * an export (metadata files, descriptions, filenames).
 * Leaves the narrative itself untouched — only identifier-shaped tokens go.
 */
export function scrubIdentifiers(text: string): string {
  if (!text) return "";
  return text
    .replace(EMAIL_RE, "[email removed]")
    .replace(UUID_RE, "[id removed]")
    .replace(PATH_RE, "[path removed]")
    .replace(COORD_RE, "[location removed]")
    .replace(IP_RE, "[ip removed]")
    .replace(IMEI_RE, "[device id removed]");
}

/** Fields we never want to leak into an export bundle. */
const PRIVATE_KEYS = [
  "user_id", "userId", "account", "accountId", "email", "phone", "gps", "gpsLatitude",
  "gpsLongitude", "latitude", "longitude", "device", "deviceId", "serial", "imei",
  "ip", "ipAddress", "session", "accessToken", "token", "apiKey", "make", "model",
  "lensModel", "cameraOwnerName", "artistEmail", "hostname", "filePath",
];

/** Deep-clone an object with private identifier fields removed. */
export function scrubMetadataObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (PRIVATE_KEYS.some(p => p.toLowerCase() === k.toLowerCase())) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = scrubMetadataObject(v);
    else if (typeof v === "string") out[k] = scrubIdentifiers(v);
    else out[k] = v;
  }
  return out;
}

/**
 * Re-encode an image through a canvas. This drops ALL embedded EXIF/XMP/IPTC
 * blocks — which is where GPS coordinates, camera serials and account names
 * live — while keeping the pixels identical.
 *
 * Provenance is not carried in EXIF for our exports: it is written as a
 * sidecar PROVENANCE.txt / disclosure file in the same bundle, so removing
 * EXIF never hides AI involvement.
 */
export async function stripImageMetadata(
  src: string,
  mime: "image/png" | "image/jpeg" = "image/png",
): Promise<Uint8Array | null> {
  try {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, mime, 0.95));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/** Filename that carries no account or device hints. */
export function safeFileName(name: string, fallback = "export"): string {
  const cleaned = scrubIdentifiers(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}
