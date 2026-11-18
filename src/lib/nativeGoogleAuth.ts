// Google sign-in for the installed Android/TV app.
// Google refuses sign-in inside an app's built-in web view, and the app's own
// pages have no sign-in service, so the app opens oraclelunar.com/native-auth
// in Chrome. That page signs in with Google, then hands the session back to the
// app through the app.oraclelunar.ai://auth link, sealed with a one-time key
// that only the app knows (it travels in the page's #fragment, never to a server).

export const NATIVE_AUTH_SCHEME = "app.oraclelunar.ai";
export const NATIVE_AUTH_SITE = "https://oraclelunar.com/native-auth";
const APP_KEY_STORE = "ol_native_auth_key";
const KEY_MAX_AGE_MS = 15 * 60 * 1000;

export type HandoffSession = { access_token: string; refresh_token: string };

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(t + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));
};

export function newHandoffKey(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function aesKey(k: string) {
  const raw = fromB64url(k);
  if (raw.length !== 32) throw new Error("bad key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealSession(k: string, s: HandoffSession): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new TextEncoder().encode(JSON.stringify({ a: s.access_token, r: s.refresh_token }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(k), body));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return b64url(out);
}

export async function openSession(k: string, sealed: string): Promise<HandoffSession> {
  const buf = fromB64url(sealed);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(0, 12) }, await aesKey(k), buf.subarray(12));
  const j = JSON.parse(new TextDecoder().decode(plain));
  if (typeof j?.a !== "string" || typeof j?.r !== "string") throw new Error("bad session");
  return { access_token: j.a, refresh_token: j.r };
}

/** Builds the link that hands the sealed session back to the app. */
export function appReturnLink(sealed: string): string {
  return `${NATIVE_AUTH_SCHEME}://auth#d=${sealed}`;
}

/** Reads the sealed session from an app.oraclelunar.ai://auth link, or null. */
export function sealedFromAppLink(url: string): string | null {
  if (!url.startsWith(`${NATIVE_AUTH_SCHEME}://auth`)) return null;
  const m = /[#&?]d=([A-Za-z0-9_-]+)/.exec(url);
  return m ? m[1] : null;
}

export function isNativeApp(): boolean {
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

/** Installed app: open Google sign-in in Chrome; the session comes back via the app link. */
export async function startNativeGoogleSignIn(): Promise<void> {
  const k = newHandoffKey();
  localStorage.setItem(APP_KEY_STORE, JSON.stringify({ k, t: Date.now() }));
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: `${NATIVE_AUTH_SITE}#k=${k}` });
}

/** Installed app: listens for the sign-in hand-back and sets the session. */
export async function installNativeAuthReturn(): Promise<void> {
  const { App } = await import("@capacitor/app");
  const handle = async (url: string) => {
    const sealed = sealedFromAppLink(url);
    if (!sealed) return;
    let stored: { k?: string; t?: number } = {};
    try { stored = JSON.parse(localStorage.getItem(APP_KEY_STORE) || "{}"); } catch { /* none */ }
    localStorage.removeItem(APP_KEY_STORE);
    try { const { Browser } = await import("@capacitor/browser"); await Browser.close(); } catch { /* already closed */ }
    const { toast } = await import("sonner");
    if (!stored.k || !stored.t || Date.now() - stored.t > KEY_MAX_AGE_MS) {
      toast.error("Google sign-in timed out. Please tap Continue with Google again.");
      return;
    }
    try {
      const session = await openSession(stored.k, sealed);
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.setSession(session);
      if (error) throw error;
      window.location.assign("/");
    } catch {
      toast.error("Google sign-in didn't finish. Please try again.");
    }
  };
  App.addListener("appUrlOpen", ({ url }) => { void handle(url); });
  try { const launch = await App.getLaunchUrl(); if (launch?.url) void handle(launch.url); } catch { /* none */ }
}
