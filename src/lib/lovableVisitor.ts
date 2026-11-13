/**
 * Visitors who click Oracle Lunar on Lovable land here without an account.
 * Instead of the install listing, they first watch the funny ad, which ends
 * with links into the real app on oraclelunar.com.
 */
const LOVABLE_HOST = /(^|\.)(lovable\.dev|lovable\.app|lovableproject\.com)$/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** True when the visit came from a Lovable page (link, showcase or embed). */
export function cameFromLovable(input: {
  referrer?: string;
  search?: string;
  ancestorOrigins?: string[];
  ownHost?: string;
}): boolean {
  const params = new URLSearchParams(input.search ?? "");
  if (params.get("from") === "lovable") return true;
  const own = (input.ownHost ?? "").toLowerCase();
  const sources = [input.referrer ?? "", ...(input.ancestorOrigins ?? [])];
  return sources.some((s) => {
    const h = hostOf(s);
    return Boolean(h) && h !== own && LOVABLE_HOST.test(h);
  });
}

export const LOVABLE_LANDING = "/ad?v=funny&from=lovable";

const SHOWN_KEY = "oracle-lunar_lovable_ad_shown";

/** Reads the current browser visit; true only once per tab so the home page stays reachable afterwards. */
export function isLovableVisit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(SHOWN_KEY) === "1") return false;
  } catch {
    /* storage blocked: still show the ad */
  }
  const ao = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  return cameFromLovable({
    referrer: document.referrer,
    search: window.location.search,
    ancestorOrigins: ao ? Array.from(ao) : [],
    ownHost: window.location.hostname,
  });
}

/** Called by the ad page once a Lovable visitor has seen it. */
export function markLovableAdShown(): void {
  try {
    sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Search robots and link-preview fetchers keep seeing the normal home page. */
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless|bingpreview|whatsapp|telegram|discord|skype|pinterest|vkshare|w3c_validator/i;

export function isBotUserAgent(ua: string): boolean {
  return BOT_UA.test(ua || "");
}

/** Landing ad for ordinary visitors arriving from the internet. */
export const WEB_LANDING = "/ad?v=funny&from=web";

/**
 * Decides where a signed-out browser visitor on the home page goes first.
 * Returns the ad path once per tab, or null to show the normal page.
 */
export function landingAdPath(input: { ua: string; alreadyShown: boolean; fromLovable: boolean }): string | null {
  if (input.alreadyShown || isBotUserAgent(input.ua)) return null;
  return input.fromLovable ? LOVABLE_LANDING : WEB_LANDING;
}

/** Reads the current browser visit for the home page. */
export function currentLandingAd(): string | null {
  if (typeof window === "undefined") return null;
  let shown = false;
  try {
    shown = sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    /* storage blocked */
  }
  return landingAdPath({ ua: navigator.userAgent, alreadyShown: shown, fromLovable: isLovableVisit() });
}
