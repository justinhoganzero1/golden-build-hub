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

// oraclelunar.com is the live primary web address; oracle-lunar.online does not
// currently load, so installs and links must never bounce visitors there.
export const PUBLIC_HOST = "oraclelunar.com";
/** Every web address that serves the real production app. */
export const PRODUCTION_HOSTS = ["oraclelunar.com", "www.oraclelunar.com", "oracle-lunar.online", "www.oracle-lunar.online"];
export const PUBLIC_ORIGIN = `https://${PUBLIC_HOST}`;
export const PUBLIC_URL = `${PUBLIC_ORIGIN}/`;

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
// Hosted in the public `app-downloads` Supabase Storage bucket.
// Upload your built file as `oracle-lunar.apk` to make this URL live.
export const ANDROID_APK_URL =
  "https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/app-downloads/oracle-lunar.apk";
export const ANDROID_APK_VERSION = "1.0.4";

/** Starts the real Android app download. Call it straight from a tap so the browser allows it. */
export const downloadApk = (): void => {
  if (!ANDROID_APK_URL || typeof document === "undefined") return;
  const a = document.createElement("a");
  a.href = ANDROID_APK_URL;
  a.download = `oracle-lunar-${ANDROID_APK_VERSION}.apk`;
  a.rel = "noopener noreferrer";
  // Visitors download the app before they have an account, so the guest sign-in gate must let this through.
  a.setAttribute("data-auth-allow", "");
  document.body.appendChild(a);
  a.click();
  a.remove();
};

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

/**
 * True only when the hosted .apk file really exists. The URL is configured even
 * before a build is uploaded, so ask storage instead of trusting the constant.
 */
export const checkApkAvailable = async (): Promise<boolean> => {
  if (!hasDirectApk()) return false;
  try {
    const res = await fetch(ANDROID_APK_URL, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
};

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
    return PRODUCTION_HOSTS.includes(window.location.hostname.toLowerCase());
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
    // "noopener" makes window.open return null even on success, which used to
    // open the site twice; open plainly and cut the link back to this page.
    const w = window.open(target, "_blank");
    if (w) {
      try { w.opener = null; } catch { /* ignore */ }
      return;
    }
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
