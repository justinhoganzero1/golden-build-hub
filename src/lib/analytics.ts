// Lightweight, best-effort event tracking that piggybacks on the existing
// public.page_views table. The `page` column doubles as an event name; we
// prefix with "event:" so it's easy to filter analytics events from real
// page views in dashboards.
//
// Never throws — failures are swallowed and logged to console so instrumentation
// can't break the UI.
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsEventName =
  | "api_key_reminder_shown"
  | "api_key_reminder_dismissed"
  | "api_key_reminder_cta_clicked"
  | "youtube_clip_preview_opened"
  | "youtube_clip_preview_closed"
  | "oauth_authorization_revoked";

const EVENT_PREFIX = "event:";

export async function trackEvent(
  name: AnalyticsEventName,
  meta?: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  try {
    // Encode metadata via the utm_* columns so we don't need a schema change.
    // Keep values short — page_views has plain text columns.
    const stringify = (v: unknown) =>
      v == null ? null : typeof v === "string" ? v.slice(0, 200) : String(v).slice(0, 200);
    await supabase.from("page_views").insert({
      page: `${EVENT_PREFIX}${name}`,
      referrer: typeof window !== "undefined" ? window.location.pathname : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
      utm_source: stringify(meta?.source),
      utm_medium: stringify(meta?.medium),
      utm_campaign: stringify(meta?.detail),
    });
  } catch (err) {
    // Never let analytics break the app.
    if (typeof console !== "undefined") console.warn("[analytics] failed", name, err);
  }
}
