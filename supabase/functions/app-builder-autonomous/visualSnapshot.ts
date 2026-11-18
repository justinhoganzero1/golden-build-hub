// Pure helpers for the App Builder "look at a website" stage (no Deno imports,
// so they can be unit tested from vitest).

const MAX_SITES = 2;

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (!h.includes(".") && !h.includes(":")) return true; // bare intranet names
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return h.includes(":");
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/** Normalises one candidate into a safe public https/http URL, or null. */
export function cleanSiteUrl(raw: string): string | null {
  let s = String(raw || "").trim().replace(/[),.;:!?'"\]>]+$/g, "");
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    if (!/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return null;
    s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (isPrivateHost(u.hostname)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Finds up to 2 public website links the member wants used as inspiration. */
export function extractInspirationUrls(text: string, extra: unknown[] = []): string[] {
  const found: string[] = [];
  const add = (c: string) => {
    const u = cleanSiteUrl(c);
    if (u && !found.some((f) => new URL(f).hostname === new URL(u).hostname)) found.push(u);
  };
  for (const e of extra) if (typeof e === "string") add(e);
  const re = /\bhttps?:\/\/[^\s<>"'`]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"'`]*)?/gi;
  for (const m of String(text || "").matchAll(re)) add(m[0]);
  return found.slice(0, MAX_SITES);
}

export interface SiteSnapshot {
  url: string;
  title?: string;
  desktop?: string; // screenshot URL
  mobile?: string;  // screenshot URL
  brandingNote?: string;
  textSample?: string;
}

/** Short, model-friendly summary of Firecrawl's branding block (colours, fonts). */
export function summariseBranding(branding: unknown): string {
  if (!branding || typeof branding !== "object") return "";
  const b = branding as Record<string, any>;
  const parts: string[] = [];
  if (b.colorScheme) parts.push(`scheme: ${b.colorScheme}`);
  if (b.colors && typeof b.colors === "object") {
    const cols = Object.entries(b.colors).filter(([, v]) => typeof v === "string").slice(0, 8)
      .map(([k, v]) => `${k} ${v}`);
    if (cols.length) parts.push(`colours: ${cols.join(", ")}`);
  }
  const fams = b.typography?.fontFamilies;
  if (fams && typeof fams === "object") {
    const f = Object.entries(fams).filter(([, v]) => typeof v === "string").map(([k, v]) => `${k} ${v}`);
    if (f.length) parts.push(`fonts: ${f.join(", ")}`);
  } else if (Array.isArray(b.fonts)) {
    const f = b.fonts.map((x: any) => x?.family).filter(Boolean).slice(0, 4);
    if (f.length) parts.push(`fonts: ${f.join(", ")}`);
  }
  if (b.spacing?.borderRadius) parts.push(`corner radius: ${b.spacing.borderRadius}`);
  return parts.join(" | ").slice(0, 600);
}
