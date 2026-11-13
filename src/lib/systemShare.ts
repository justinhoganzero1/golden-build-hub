// One place to open the device's own share menu ("Share via Apps").
// - Installed Android/TV/iOS app: the native share plugin (WebView has no navigator.share).
// - Browsers: navigator.share, but only where the page is allowed to use it —
//   inside an embedded preview frame the browser blocks it ("NotAllowedError").
// - Anywhere it can't open, the caller falls back to copying the link, so the
//   member is never left with a dead "share failed" message.

export type ShareOutcome = "shared" | "cancelled" | "unavailable";

export interface SystemShareData {
  title?: string;
  text?: string;
  url?: string;
  file?: File;
}

type NavLike = {
  share?: (d: ShareData) => Promise<void>;
  canShare?: (d: ShareData) => boolean;
};
type PolicyLike = { allowsFeature?: (f: string) => boolean; features?: () => string[] };
type DocLike = { featurePolicy?: PolicyLike; permissionsPolicy?: PolicyLike };

/** True when this page may open the browser's share sheet. */
export function webShareAllowed(nav: NavLike | undefined = globalThis.navigator as NavLike, doc: DocLike | undefined = globalThis.document as DocLike): boolean {
  if (!nav || typeof nav.share !== "function") return false;
  const policy = doc?.permissionsPolicy || doc?.featurePolicy;
  if (policy?.allowsFeature) {
    try {
      // Browsers answer "no" for features they don't know, so only trust the
      // answer when this browser actually lists the share feature.
      const known = typeof policy.features === "function" ? policy.features().includes("web-share") : true;
      if (known) return policy.allowsFeature("web-share");
    } catch { /* assume allowed */ }
  }
  return true;
}

/** Errors that mean the person closed the share menu themselves. */
export function isShareCancel(e: unknown): boolean {
  const err = e as { name?: string; message?: string } | null;
  if (err?.name === "AbortError") return true;
  return /cancel/i.test(String(err?.message || ""));
}

async function isNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function nativeShare(data: SystemShareData): Promise<ShareOutcome> {
  const { Share } = await import("@capacitor/share");
  const can = await Share.canShare().catch(() => ({ value: false }));
  if (!can.value) return "unavailable";
  const opts: { title?: string; text?: string; url?: string; files?: string[]; dialogTitle?: string } = {
    title: data.title,
    text: data.text,
    dialogTitle: "Share with",
  };
  if (data.file) {
    // The native menu needs a real file on the device, so write it to the app cache first.
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const safe = data.file.name.replace(/[^\w.\-]+/g, "_") || "oracle-lunar-file";
    const written = await Filesystem.writeFile({
      path: `share/${Date.now()}-${safe}`,
      data: await blobToBase64(data.file),
      directory: Directory.Cache,
      recursive: true,
    });
    opts.files = [written.uri];
  } else if (data.url) {
    opts.url = data.url;
  }
  try {
    await Share.share(opts);
    return "shared";
  } catch (e) {
    if (isShareCancel(e)) return "cancelled";
    throw e;
  }
}

/** True when some share menu (native app or browser) can be offered here. */
export async function systemShareAvailable(): Promise<boolean> {
  if (await isNativeApp()) return true;
  return webShareAllowed();
}

/**
 * Opens the device share menu. Returns "unavailable" (never throws) when this
 * device or page can't show it, so the caller can copy the link instead.
 */
export async function systemShare(data: SystemShareData): Promise<ShareOutcome> {
  if (await isNativeApp()) {
    try { return await nativeShare(data); } catch (e) { return isShareCancel(e) ? "cancelled" : "unavailable"; }
  }
  const nav = globalThis.navigator as NavLike | undefined;
  if (!webShareAllowed(nav)) return "unavailable";
  const payload: ShareData = data.file && nav?.canShare?.({ files: [data.file] })
    ? { files: [data.file], title: data.title, text: data.text }
    : { title: data.title, text: data.text, url: data.url };
  if (!payload.files && !payload.url) return "unavailable";
  try {
    await nav!.share!(payload);
    return "shared";
  } catch (e) {
    if (isShareCancel(e)) return "cancelled";
    return "unavailable";
  }
}
