// Records why a screen showed "This page couldn't continue" so the owner can
// see the real cause (page, short message, device) in the Owner Dashboard.
// No prompts, tokens or private text are sent — only the error itself.
import { supabase } from "@/integrations/supabase/client";

const CHUNK_RE = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically|ChunkLoadError|Loading chunk \d+ failed|Unable to preload CSS/i;
const RELOAD_KEY = "ol_stale_reload_at";

/** True when the error means an old copy of the app asked for a piece that a newer publish replaced. */
export function isStaleAppError(message: string): boolean {
  return CHUNK_RE.test(message);
}

/** Reload once (per minute) to fetch the newest app; returns false if we already tried. */
export function reloadForFreshApp(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (now - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch { /* storage blocked: still try once */ }
  window.location.reload();
  return true;
}

function appKind(): "native" | "installed" | "browser" {
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  if (w.Capacitor?.isNativePlatform?.()) return "native";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "installed";
  return "browser";
}

const sent = new Set<string>();
export async function reportCrash(page: string, error: unknown): Promise<void> {
  try {
    const err = error as { message?: string; stack?: string } | undefined;
    const message = String(err?.message ?? error ?? "Unknown error").slice(0, 1000);
    const key = `${page}|${message}`;
    if (sent.has(key)) return;
    sent.add(key);
    const { data } = await supabase.auth.getSession();
    await supabase.from("client_crash_reports").insert({
      user_id: data.session?.user.id ?? null,
      page: page.slice(0, 120),
      path: window.location.pathname.slice(0, 300),
      message,
      stack: err?.stack ? String(err.stack).slice(0, 4000) : null,
      user_agent: navigator.userAgent.slice(0, 400),
      app_kind: appKind(),
    });
  } catch { /* reporting must never cause a second crash */ }
}
