/**
 * Demo Mode detector.
 *
 * The web preview at oracle-lunar.online / *.lovable.app is a PLASTIC DISPLAY.
 * Nothing real happens. Every AI/feature call is intercepted and replaced with
 * a "Download the ORACLE LUNAR app" message.
 *
 * Real functionality only unlocks when:
 *  1. The user has installed the PWA (display-mode: standalone), AND
 *  2. They are signed in (handled separately by RequireAuth).
 *
 * Override for QA: append ?live=1 to any URL — stored in sessionStorage.
 */

const LIVE_OVERRIDE_KEY = "oracle-lunar_live_override";

const computeDemoMode = (): boolean => {
  if (typeof window === "undefined") return false;

  // QA / owner override
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("live") === "1") {
      sessionStorage.setItem(LIVE_OVERRIDE_KEY, "1");
    }
    if (sessionStorage.getItem(LIVE_OVERRIDE_KEY) === "1") return false;
  } catch {
    /* ignore */
  }

  // Installed PWA = real app
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true;

  // Capacitor native shell = real app
  // @ts-expect-error capacitor injects this
  const isNative = !!window.Capacitor?.isNativePlatform?.();

  return !(standalone || isNative);
};

export const isDemoMode = (): boolean => computeDemoMode();

export const DEMO_REPLY =
  "This is a demo preview. Download the ORACLE LUNAR app and sign up to unlock the real Oracle and every feature.";

export const DEMO_TOAST_TITLE = "Demo preview";
export const DEMO_TOAST_DESC =
  "Download the ORACLE LUNAR app to use this feature for real.";
