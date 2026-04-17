/**
 * Speed AI — maximizes app responsiveness by:
 *  1. Maintaining a registry of route → lazy loader functions
 *  2. Prefetching route chunks on pointer/touch hover (before click)
 *  3. Warming idle routes during browser idle time, prioritized by likelihood
 *  4. Prefetching on viewport visibility for in-view nav links
 *
 * Pure utility — no React imports, safe to call from anywhere.
 */

type Loader = () => Promise<unknown>;

const registry = new Map<string, Loader>();
const prefetched = new Set<string>();
const inflight = new Map<string, Promise<unknown>>();

/** Register a route → dynamic-import loader pair. Call once at app start. */
export const registerRoute = (path: string, loader: Loader) => {
  registry.set(path, loader);
};

/** Bulk register. */
export const registerRoutes = (entries: Record<string, Loader>) => {
  for (const [path, loader] of Object.entries(entries)) registerRoute(path, loader);
};

/** Prefetch a specific route chunk if not already cached. */
export const prefetchRoute = (path: string): Promise<unknown> | undefined => {
  if (prefetched.has(path)) return;
  const loader = registry.get(path);
  if (!loader) return;
  if (inflight.has(path)) return inflight.get(path);

  const p = loader()
    .then((mod) => {
      prefetched.add(path);
      inflight.delete(path);
      return mod;
    })
    .catch((err) => {
      inflight.delete(path);
      // Silent fail — actual navigation will retry and surface the error.
      console.warn(`[SpeedAI] Prefetch failed for ${path}`, err);
    });
  inflight.set(path, p);
  return p;
};

/** Prefetch many routes. */
export const prefetchRoutes = (paths: string[]) => paths.forEach(prefetchRoute);

/**
 * Warm idle routes. Call once on app mount. Uses requestIdleCallback when
 * available; falls back to staggered setTimeout. Skips on slow networks/data-saver.
 */
export const startIdleWarmup = (priorityPaths: string[] = []) => {
  if (typeof window === "undefined") return;

  // Respect Save-Data and slow connections
  const conn = (navigator as any).connection;
  if (conn?.saveData) return;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

  const idle: (cb: () => void) => void =
    (window as any).requestIdleCallback
      ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 2000 })
      : (cb) => setTimeout(cb, 300);

  const queue = [
    ...priorityPaths.filter((p) => registry.has(p)),
    ...Array.from(registry.keys()).filter((p) => !priorityPaths.includes(p)),
  ];

  let i = 0;
  const pump = () => {
    if (i >= queue.length) return;
    const path = queue[i++];
    prefetchRoute(path);
    idle(pump);
  };
  idle(pump);
};

/**
 * Attach hover/touch/focus prefetch to a single anchor or button element.
 * The element must expose the destination via `data-prefetch="/path"` or `href`.
 */
export const attachPrefetchHandlers = (el: HTMLElement) => {
  const getPath = () =>
    el.dataset.prefetch ||
    (el as HTMLAnchorElement).getAttribute?.("href") ||
    "";

  const trigger = () => {
    const path = getPath();
    if (path && path.startsWith("/")) prefetchRoute(path);
  };

  el.addEventListener("pointerenter", trigger, { passive: true });
  el.addEventListener("touchstart", trigger, { passive: true });
  el.addEventListener("focus", trigger);
};

/**
 * Global delegate — prefetches any link/button with a known route on
 * hover/touch/focus, without per-component wiring. Call once on mount.
 */
export const installGlobalPrefetchDelegate = () => {
  if (typeof window === "undefined") return;
  if ((window as any).__speedAIInstalled) return;
  (window as any).__speedAIInstalled = true;

  const handler = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest) return;
    const el = target.closest<HTMLElement>("a[href^='/'],[data-prefetch]");
    if (!el) return;
    const path =
      el.dataset.prefetch ||
      (el as HTMLAnchorElement).getAttribute?.("href") ||
      "";
    if (path.startsWith("/")) prefetchRoute(path);
  };

  window.addEventListener("pointerover", handler, { passive: true, capture: true });
  window.addEventListener("touchstart", handler, { passive: true, capture: true });
  window.addEventListener("focusin", handler, { capture: true });
};

/** Diagnostics for debugging. */
export const getSpeedAIStats = () => ({
  registered: registry.size,
  prefetched: prefetched.size,
  inflight: inflight.size,
});
