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
