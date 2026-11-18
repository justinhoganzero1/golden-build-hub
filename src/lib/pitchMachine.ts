// Client helpers for the owner-only Client Pitch Machine.
export { demoState, newExpiry, lockDemoHtml, DEMO_DAYS, type DeckSlide, type DemoState } from "../../supabase/functions/_shared/pitchDemo";

export const PITCH_STEPS = [
  { key: "scan", label: "Scan website & reviews", running: "scanning", done: "scanned" },
  { key: "analyse", label: "AI audit", running: "analysing", done: "analysed" },
  { key: "build", label: "Build website + app demo", running: "building", done: "built" },
  { key: "pitch", label: "Presentation + email", running: "pitching", done: "ready" },
] as const;
export type PitchStep = (typeof PITCH_STEPS)[number]["key"];

export const RUNNING_STATUSES: string[] = PITCH_STEPS.map((s) => s.running);

/** Public site only — clients never get a Lovable address. */
export const PUBLIC_SITE = "https://oraclelunar.com";

export function demoLink(token: string): string {
  return `${PUBLIC_SITE}/demo/${encodeURIComponent(token)}`;
}

export function newDemoToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export function fillEmail(body: string, link: string): string {
  const text = String(body || "");
  return text.includes("{{DEMO_LINK}}") ? text.split("{{DEMO_LINK}}").join(link) : `${text}\n\nSee your demo: ${link}`;
}

export function mailtoHref(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
}

/** Which step finished last, so "Run everything" can continue from there. */
export function nextStep(row: { snapshot?: unknown; audit?: unknown; demo_html?: string | null; deck?: unknown }): PitchStep | null {
  if (!row.snapshot) return "scan";
  if (!row.audit) return "analyse";
  if (!row.demo_html) return "build";
  if (!row.deck) return "pitch";
  return null;
}
