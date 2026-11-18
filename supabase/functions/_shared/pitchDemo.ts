// Pure helpers for the owner-only Client Pitch Machine and its public demo
// page. No Deno imports so vitest can test them.

export const DEMO_DAYS = 7;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
// Phone numbers must look dialable: start with +, 0, ( or 13/18 (AU), so
// image IDs and other long digit runs in page code are ignored.
const PHONE_RE = /(?<![\w/=.-])(?:\+\d{1,3}[\s.-]?|\(0\d\)\s?|0\d[\s.-]?|1[38]00[\s.-]?|13[\s.-]?)\d[\d\s.-]{5,12}\d(?![\w/])/g;
const JUNK_EMAIL = /(example\.|sentry|wixpress|@2x|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|noreply|no-reply|domain\.com|email\.com|yourname|u003e)/i;

export interface FoundContacts {
  emails: string[];
  phones: string[];
  contactPage?: string;
}

/** Pulls public contact emails/phones and a contact-page link from a scraped page. */
export function extractContacts(markdown: string, links: string[] = [], base?: string): FoundContacts {
  const text = String(markdown || "");
  const emails = new Set<string>();
  for (const l of links) {
    const m = /^mailto:([^?]+)/i.exec(l || "");
    if (m) emails.add(decodeURIComponent(m[1]).trim().toLowerCase());
  }
  for (const m of text.matchAll(EMAIL_RE)) emails.add(m[0].toLowerCase());
  const phones = new Set<string>();
  for (const l of links) {
    const m = /^tel:(.+)$/i.exec(l || "");
    if (m) phones.add(decodeURIComponent(m[1]).replace(/\s+/g, " ").trim());
  }
  const plain = text.replace(/!?\[[^\]]*\]\([^)]*\)/g, " ").replace(/https?:\/\/\S+/g, " ");
  for (const m of plain.matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15 && !/^(19|20)\d{6}$/.test(digits)) phones.add(m[0].replace(/\s+/g, " ").trim());
  }
  let contactPage: string | undefined;
  let host = "";
  try { host = base ? new URL(base).hostname.replace(/^www\./, "") : ""; } catch { /* ignore */ }
  for (const l of links) {
    if (!/^https?:/i.test(l || "")) continue;
    try {
      const u = new URL(l);
      if (host && u.hostname.replace(/^www\./, "") !== host) continue;
      if (/contact|get-in-touch|enquir|reach-us|about/i.test(u.pathname)) { contactPage = u.toString(); if (/contact/i.test(u.pathname)) break; }
    } catch { /* ignore */ }
  }
  return {
    emails: [...emails].filter((e) => !JUNK_EMAIL.test(e)).slice(0, 6),
    phones: [...phones].slice(0, 4),
    contactPage,
  };
}

export function mergeContacts(a: FoundContacts, b: FoundContacts): FoundContacts {
  return {
    emails: [...new Set([...a.emails, ...b.emails])].slice(0, 6),
    phones: [...new Set([...a.phones, ...b.phones])].slice(0, 4),
    contactPage: a.contactPage || b.contactPage,
  };
}

/** Web searches used to find what customers say (Google reviews, Trustpilot, Facebook, ProductReview). */
export function reviewQueries(name: string, host: string): { source: string; query: string }[] {
  const n = String(name || host).replace(/["]/g, "").slice(0, 80).trim() || host;
  return [
    { source: "Google reviews", query: `"${n}" reviews complaints` },
    { source: "Google Maps", query: `"${n}" google reviews ${host}` },
    { source: "Trustpilot", query: `site:trustpilot.com "${n}"` },
    { source: "Facebook", query: `site:facebook.com "${n}" reviews` },
    { source: "ProductReview", query: `site:productreview.com.au "${n}"` },
  ];
}

export function parseJsonLoose<T = unknown>(text: string): T | null {
  const s = String(text || "").trim();
  const tries = [s, s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")];
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) tries.push(s.slice(a, b + 1));
  for (const t of tries) {
    try { return JSON.parse(t) as T; } catch { /* next */ }
  }
  return null;
}

export function extractHtml(text: string): string {
  const s = String(text || "");
  const fence = s.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence && /<html|<!doctype/i.test(fence[1])) return fence[1].trim();
  const doc = s.match(/<!DOCTYPE[\s\S]*<\/html>/i) || s.match(/<html[\s\S]*<\/html>/i);
  return doc ? doc[0] : "";
}

export type DemoState = "active" | "off" | "expired" | "not_built";

export function demoState(row: { demo_enabled?: boolean | null; demo_expires_at?: string | null; demo_html?: string | null }, now = new Date()): DemoState {
  if (!row?.demo_html) return "not_built";
  if (!row.demo_enabled) return "off";
  if (!row.demo_expires_at || new Date(row.demo_expires_at).getTime() <= now.getTime()) return "expired";
  return "active";
}

export function newExpiry(now = new Date()): string {
  return new Date(now.getTime() + DEMO_DAYS * 86_400_000).toISOString();
}

// Content rules for the demo frame: styling/fonts/pictures may load, but the
// demo can never send or save anything online (no fetch, forms, frames).
export const DEMO_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src data: blob: https:",
  "media-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
].join("; ");

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Locks a generated demo: offline content rules, watermark and demo banner. */
export function lockDemoHtml(html: string, opts: { businessName: string; expiresAt?: string | null }): string {
  let doc = String(html || "");
  doc = doc.replace(/<base\b[^>]*>/gi, "")
    .replace(/<meta[^>]+http-equiv\s*=\s*["']?(refresh|content-security-policy)["']?[^>]*>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(object|embed)\b[^>]*>/gi, "");
  if (!/<html[\s>]/i.test(doc)) doc = `<!DOCTYPE html><html><head></head><body>${doc}</body></html>`;
  if (!/<head[\s>]/i.test(doc)) doc = doc.replace(/<html([^>]*)>/i, "<html$1><head></head>");
  const until = opts.expiresAt ? new Date(opts.expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";
  const meta = `<meta http-equiv="Content-Security-Policy" content="${DEMO_CSP}"><meta name="robots" content="noindex,nofollow">`;
  doc = doc.replace(/<head([^>]*)>/i, `<head$1>${meta}`);
  const label = `DEMO for ${esc(opts.businessName || "your business")} — prepared by Oracle Lunar. Not licensed for use.${until ? ` Expires ${esc(until)}.` : ""}`;
  const mark = `<div aria-hidden="true" style="position:fixed;inset:0;pointer-events:none;z-index:2147483646;opacity:.07;background-image:url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><text x='10' y='100' transform='rotate(-20 160 90)' font-family='Arial' font-size='22' fill='%23000'>ORACLE LUNAR DEMO</text></svg>&quot;);"></div>`
    + `<div role="note" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(10,12,20,.88);color:#f5d27a;font:600 12px/1.3 Arial,sans-serif;padding:6px 10px;text-align:center;pointer-events:none">${label}</div>`
    + `<script>document.addEventListener('contextmenu',function(e){e.preventDefault()});</script>`;
  doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${mark}</body>`) : `${doc}${mark}`;
  return doc;
}

export interface DeckSlide { kind: string; title: string; subtitle?: string; bullets: string[]; quote?: string; }

/** Keeps the AI's slides to a safe, bounded shape. */
export function normaliseDeck(raw: unknown): DeckSlide[] {
  const arr = Array.isArray((raw as any)?.slides) ? (raw as any).slides : Array.isArray(raw) ? raw : [];
  return arr.slice(0, 8).map((s: any) => ({
    kind: String(s?.kind || "content").slice(0, 20),
    title: String(s?.title || "").slice(0, 120),
    subtitle: s?.subtitle ? String(s.subtitle).slice(0, 240) : undefined,
    bullets: (Array.isArray(s?.bullets) ? s.bullets : []).slice(0, 6).map((b: unknown) => String(b).slice(0, 220)),
    quote: s?.quote ? String(s.quote).slice(0, 300) : undefined,
  })).filter((s: DeckSlide) => s.title);
}
