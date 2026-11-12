// Records the FIRST page a website visitor lands on (once per browser tab),
// with where they came from. Anonymous: no name, email or account is stored.
import { supabase } from "@/integrations/supabase/client";

const WEBSITE_HOSTS = new Set(["oraclelunar.com", "www.oraclelunar.com"]);
const PRIVATE_PATHS = /^\/(owner|admin)/i;
const SESSION_KEY = "oracle-lunar-arrival-recorded";

/** Only real website visits on oraclelunar.com count — not the editor preview, the installed app or owner pages. */
export function shouldRecordArrival(hostname: string, pathname: string): boolean {
  return WEBSITE_HOSTS.has(hostname.toLowerCase()) && !PRIVATE_PATHS.test(pathname);
}

export interface ArrivalRow {
  landing_path: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  referrer: string | null;
  user_agent: string | null;
}

const clip = (v: string | null | undefined, n: number) => (v ? v.trim().slice(0, n) || null : null);

/** Source rule matches the owner dashboard: utm_source, else the outside site that linked here, else "direct". */
export function buildArrival(href: string, referrer: string, userAgent: string): ArrivalRow {
  const url = new URL(href);
  const p = url.searchParams;
  let source = clip(p.get("utm_source"), 100)?.toLowerCase() ?? null;
  if (!source && referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
      if (host && host !== url.hostname.replace(/^www\./, "").toLowerCase()) source = host.slice(0, 100);
    } catch { /* ignore bad referrer */ }
  }
  return {
    landing_path: (url.pathname || "/").slice(0, 200),
    source: source || "direct",
    medium: clip(p.get("utm_medium"), 100),
    campaign: clip(p.get("utm_campaign"), 100),
    referrer: clip(referrer, 500),
    user_agent: clip(userAgent, 200),
  };
}

export function recordSiteArrival(): void {
  try {
    if (typeof window === "undefined") return;
    const { hostname, pathname, href } = window.location;
    if (!shouldRecordArrival(hostname, pathname)) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const row = buildArrival(href, document.referrer || "", navigator.userAgent || "");
    void supabase.from("site_arrivals").insert(row).then(() => {}, () => {});
  } catch { /* tracking must never break the site */ }
}
