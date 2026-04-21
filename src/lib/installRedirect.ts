/**
 * Centralized helper used by every "Install / Download" entry point.
 *
 * The Lovable editor runs the app inside a sandboxed iframe whose URL is
 * `id-preview--…lovable.app` (a.k.a. "builderr.lovable" in the address bar).
 * The PWA install prompt and any home-screen install can NEVER work from
 * that origin — the manifest's `start_url` belongs to the production domain.
 *
 * Whenever an install/download CTA is triggered from such a context we
 * forcibly bounce the visitor to the live production URL so the install
 * actually works. On the real production host this is a no-op.
 */

export const PUBLIC_HOST = "oracle-lunar.online";
export const PUBLIC_URL = "https://oracle-lunar.online/";

/**
 * Optional native-app store links. When set, install CTAs prefer these
 * over the PWA prompt so users get the *actual app*, not a saved shortcut
 * to the website. Leave blank until the listings are live.
 */
export const PLAY_STORE_URL = "";   // e.g. "https://play.google.com/store/apps/details?id=app.oraclelunar.ai"
export const APP_STORE_URL = "";    // e.g. "https://apps.apple.com/app/idXXXXXXXXX"

/**
 * Direct Android .apk download hosted on our own portal/CDN. When set,
 * Android users get the *real native app* delivered straight to their
 * phone instead of a PWA shortcut. Leave blank until the .apk is uploaded.
 *
 * Recommended hosts: Supabase Storage (public bucket), GitHub Releases,
 * or a /downloads path on the production domain.
 */
export const ANDROID_APK_URL = "";  // e.g. "https://oracle-lunar.online/downloads/oracle-lunar.apk"
export const ANDROID_APK_VERSION = "1.0.0";

/** Returns the best native store URL for the current device, or null. */
export const getNativeStoreUrl = (): string | null => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) && APP_STORE_URL) return APP_STORE_URL;
  if (/android/.test(ua) && PLAY_STORE_URL) return PLAY_STORE_URL;
  return null;
};

/** True when we have a hosted .apk available for direct sideload. */
export const hasDirectApk = (): boolean => Boolean(ANDROID_APK_URL);

/** True when the current device is Android (any browser). */
export const isAndroidDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
};

/** True when the current page is the real production deployment. */
export const isOnProductionHost = (): boolean => {
  try {
    if (typeof window === "undefined") return true;
    // Inside any iframe (Lovable preview, embedded webviews) → not production-safe.
    if (window.self !== window.top) return false;
    return window.location.hostname === PUBLIC_HOST;
  } catch {
    return false;
  }
};

/**
 * Send the visitor to the live production site. Tries three escape hatches in
 * order so we work in iframes, popup-blocked browsers, and plain tabs.
 *
 * @param path optional path on production (defaults to the home page).
 */
export const openProductionSite = (path = "/"): void => {
  const target = path.startsWith("http")
    ? path
    : `https://${PUBLIC_HOST}${path.startsWith("/") ? path : `/${path}`}`;

  // 1. Break out of the editor iframe to top-level navigation.
  try {
    const top = window.top as Window | null;
    if (top && top !== window.self) {
      top.location.href = target;
      return;
    }
  } catch {
    /* cross-origin → fall through */
  }

  // 2. Try a fresh tab so the user keeps the editor preview open.
  try {
    const w = window.open(target, "_blank", "noopener,noreferrer");
    if (w && !w.closed) return;
  } catch {
    /* blocked → fall through */
  }

  // 3. Last resort — same-tab navigation.
  window.location.href = target;
};

/**
 * Convenience: if we're not on production, bounce to it (returning true so
 * the caller can early-return). On production, returns false and lets the
 * caller continue with the real install/download flow.
 */
export const bounceIfNotProduction = (path = "/"): boolean => {
  if (isOnProductionHost()) return false;
  openProductionSite(path);
  return true;
};
