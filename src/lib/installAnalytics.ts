import { supabase } from "@/integrations/supabase/client";

export type InstallPlatform = "android" | "ios" | "desktop" | "unknown";
export type InstallEventType =
  | "click"            // user tapped Install / Download button
  | "download_start"   // .apk download was kicked off
  | "guide_open"       // user opened the in-app install checklist
  | "step_complete"    // user marked a checklist step done
  | "install_success"  // user confirmed the app installed
  | "install_failure"  // user reported a problem
  | "installed";       // PWA-installed event from beforeinstallprompt

export const detectInstallPlatform = (): InstallPlatform => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua)) return "ios";
  return "desktop";
};

/**
 * Fire-and-forget install analytics. Never throws — analytics must never
 * break the install flow. Optional `meta` is appended to the user_agent
 * field as a short tag so we can filter (e.g. step name).
 */
export const trackInstallEvent = async (
  eventType: InstallEventType,
  platform: InstallPlatform = detectInstallPlatform(),
  meta?: string,
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : "";
    await supabase.from("install_events").insert({
      event_type: eventType,
      platform,
      user_id: user?.id ?? null,
      user_agent: meta ? `${ua} | ${meta}` : ua,
    });
  } catch {
    // swallow — never block UX on analytics
  }
};
