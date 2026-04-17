import { supabase } from "@/integrations/supabase/client";

export type InstallPlatform = "android" | "ios" | "desktop" | "unknown";
export type InstallEventType = "click" | "installed";

export const detectInstallPlatform = (): InstallPlatform => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua)) return "ios";
  return "desktop";
};

/**
 * Fire-and-forget install analytics. Never throws — analytics must never
 * break the install flow.
 */
export const trackInstallEvent = async (
  eventType: InstallEventType,
  platform: InstallPlatform = detectInstallPlatform(),
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("install_events").insert({
      event_type: eventType,
      platform,
      user_id: user?.id ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch {
    // swallow — never block UX on analytics
  }
};
