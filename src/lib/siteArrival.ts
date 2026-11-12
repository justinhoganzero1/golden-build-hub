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

/** Best-guess country code from the browser's time zone, used only when the network gives no country. */
const TZ_PREFIX_COUNTRY: [RegExp, string][] = [
  [/^Australia\//, "AU"], [/^Pacific\/(Auckland|Chatham)$/, "NZ"], [/^Pacific\/Fiji$/, "FJ"], [/^Pacific\/Port_Moresby$/, "PG"],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.*|Kentucky\/.*|North_Dakota\/.*)$/, "US"],
  [/^Pacific\/Honolulu$/, "US"],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal)$/, "CA"],
  [/^America\/(Mexico_City|Cancun|Tijuana|Monterrey)$/, "MX"], [/^America\/(Sao_Paulo|Fortaleza|Manaus|Recife|Bahia)$/, "BR"],
  [/^America\/Argentina\//, "AR"], [/^America\/Santiago$/, "CL"], [/^America\/Bogota$/, "CO"], [/^America\/Lima$/, "PE"],
  [/^Europe\/London$/, "GB"], [/^Europe\/Dublin$/, "IE"], [/^Europe\/Paris$/, "FR"], [/^Europe\/Berlin$/, "DE"],
  [/^Europe\/Amsterdam$/, "NL"], [/^Europe\/Brussels$/, "BE"], [/^Europe\/Madrid$/, "ES"], [/^Europe\/Rome$/, "IT"],
  [/^Europe\/Lisbon$/, "PT"], [/^Europe\/Zurich$/, "CH"], [/^Europe\/Vienna$/, "AT"], [/^Europe\/Stockholm$/, "SE"],
  [/^Europe\/Oslo$/, "NO"], [/^Europe\/Copenhagen$/, "DK"], [/^Europe\/Helsinki$/, "FI"], [/^Europe\/Warsaw$/, "PL"],
  [/^Europe\/Prague$/, "CZ"], [/^Europe\/Budapest$/, "HU"], [/^Europe\/Athens$/, "GR"], [/^Europe\/Bucharest$/, "RO"],
  [/^Europe\/(Kyiv|Kiev)$/, "UA"], [/^Europe\/Moscow$/, "RU"], [/^Europe\/Istanbul$/, "TR"],
  [/^Asia\/(Shanghai|Chongqing|Urumqi)$/, "CN"], [/^Asia\/Hong_Kong$/, "HK"], [/^Asia\/Taipei$/, "TW"], [/^Asia\/Tokyo$/, "JP"],
  [/^Asia\/Seoul$/, "KR"], [/^Asia\/Singapore$/, "SG"], [/^Asia\/(Kuala_Lumpur|Kuching)$/, "MY"], [/^Asia\/(Jakarta|Makassar|Jayapura)$/, "ID"],
  [/^Asia\/Manila$/, "PH"], [/^Asia\/Bangkok$/, "TH"], [/^Asia\/(Ho_Chi_Minh|Saigon)$/, "VN"], [/^Asia\/(Kolkata|Calcutta)$/, "IN"],
  [/^Asia\/Karachi$/, "PK"], [/^Asia\/Dhaka$/, "BD"], [/^Asia\/Dubai$/, "AE"], [/^Asia\/Riyadh$/, "SA"], [/^Asia\/(Jerusalem|Tel_Aviv)$/, "IL"],
  [/^Africa\/Johannesburg$/, "ZA"], [/^Africa\/Lagos$/, "NG"], [/^Africa\/Nairobi$/, "KE"], [/^Africa\/Cairo$/, "EG"],
];

export function countryFromTimeZone(tz: string): string | null {
  for (const [re, code] of TZ_PREFIX_COUNTRY) if (re.test(tz)) return code;
  return null;
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
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* ignore */ }
    const { user_agent: _ua, ...visit } = row;
    // The backend step adds the visitor's country; if it fails, still keep the visit.
    void supabase.functions
      .invoke("record-arrival", { body: { ...visit, tz_country: countryFromTimeZone(tz) } })
      .then(({ error }) => { if (error) return supabase.from("site_arrivals").insert(row); })
      .then(() => {}, () => {});
  } catch { /* tracking must never break the site */ }
}
