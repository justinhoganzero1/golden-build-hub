/**
 * True full screen on phones and tablets.
 *
 * Browsers only allow full screen after a tap, so the first tap anywhere
 * hides the browser bar, the phone's status bar and the navigation bar.
 * Swiping in from the top or bottom edge shows the phone's bars again as a
 * see-through, tappable overlay (the phone's own behaviour). If the person
 * leaves full screen (Back), the next tap brings it back.
 *
 * The installed Android/TV app hides the bars natively (MainActivity), and the
 * installed web app asks for "fullscreen" in its manifest, so this only runs
 * in the browser.
 */

export type FullscreenEnv = {
  coarsePointer: boolean;
  inIframe: boolean;
  native: boolean;
  supported: boolean;
  displayFullscreen: boolean;
  tv: boolean;
};

export function shouldAutoFullscreen(env: FullscreenEnv): boolean {
  if (env.native || env.inIframe || env.tv) return false;
  if (!env.supported || !env.coarsePointer) return false;
  if (env.displayFullscreen) return false;
  return true;
}

/** Taps that open the phone's own screens (file picker, camera) leave full screen anyway. */
export function isFullscreenExemptTarget(el: Element | null): boolean {
  if (!el || typeof (el as HTMLElement).closest !== "function") return false;
  return !!(el as HTMLElement).closest('input[type="file"], label[for], [data-no-fullscreen]');
}

type FsDoc = Document & { webkitFullscreenElement?: Element | null };
type FsEl = HTMLElement & { webkitRequestFullscreen?: (o?: unknown) => Promise<void> | void };

function currentEnv(): FullscreenEnv {
  const root = document.documentElement as FsEl;
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }
  const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();
  const mq = (q: string) => { try { return window.matchMedia(q).matches; } catch { return false; } };
  const ua = navigator.userAgent || "";
  return {
    coarsePointer: mq("(pointer: coarse)") || /Android|iPad|Mobile/i.test(ua),
    inIframe,
    native,
    supported: !!(document.fullscreenEnabled && (root.requestFullscreen || root.webkitRequestFullscreen)),
    displayFullscreen: mq("(display-mode: fullscreen)"),
    tv: /OracleLunarTV|Android TV|GoogleTV|BRAVIA|AFT[A-Z]/i.test(ua),
  };
}

function isFullscreenNow(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

let installed = false;

export function installImmersiveFullscreen() {
  if (installed || typeof window === "undefined") return;
  try {
    if (localStorage.getItem("oracle-lunar-fullscreen") === "off") return;
  } catch { /* storage blocked: keep going */ }
  if (!shouldAutoFullscreen(currentEnv())) return;
  installed = true;

  const enter = (e: Event) => {
    if (isFullscreenNow()) return;
    if (isFullscreenExemptTarget(e.target as Element | null)) return;
    const root = document.documentElement as FsEl;
    try {
      const req = root.requestFullscreen
        ? root.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions)
        : root.webkitRequestFullscreen?.();
      if (req && typeof (req as Promise<void>).catch === "function") (req as Promise<void>).catch(() => {});
    } catch { /* browser refused: page still works normally */ }
  };

  // Both are "user activation" events, so the browser accepts the request.
  document.addEventListener("click", enter, { capture: true, passive: true });
  document.addEventListener("touchend", enter, { capture: true, passive: true });
}
