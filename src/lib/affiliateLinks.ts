// Affiliate referral links — keep all third-party referral URLs in one place.
import { supabase } from "@/integrations/supabase/client";

export const ELEVENLABS_AFFILIATE_URL = "https://try.elevenlabs.io/20p2fwdcfmr2";

// HeyGen affiliate link — paste your PartnerStack/HeyGen referral URL here once approved.
// Apply at: https://www.heygen.com/affiliate
// 🔴 PLACEHOLDER — all HeyGenAffiliateCTA components stay hidden until this is replaced.
export const HEYGEN_AFFILIATE_URL = "https://www.heygen.com/?sid=oraclelunar";

// Expose for the Owner Dashboard "live status" badge
if (typeof window !== "undefined") {
  (window as any).__HEYGEN_AFFILIATE_URL__ = HEYGEN_AFFILIATE_URL;
}

/**
 * Fire-and-forget click tracking. Stores in localStorage as a fallback
 * and tries to log to the affiliate_clicks table if it exists.
 */
export function trackAffiliateClick(partner: string, placement: string) {
  try {
    const key = `affiliate_clicks_${partner}`;
    const prev = parseInt(localStorage.getItem(key) || "0", 10);
    localStorage.setItem(key, String(prev + 1));
    localStorage.setItem(`${key}_last`, new Date().toISOString());
  } catch { /* noop */ }

  // Best-effort server log (won't block the navigation)
  void supabase
    .from("affiliate_clicks" as any)
    .insert({ partner, placement, clicked_at: new Date().toISOString() })
    .then(() => {}, () => {});
}

export function getAffiliateClickStats(partner: string) {
  try {
    return {
      total: parseInt(localStorage.getItem(`affiliate_clicks_${partner}`) || "0", 10),
      last: localStorage.getItem(`affiliate_clicks_${partner}_last`),
    };
  } catch {
    return { total: 0, last: null };
  }
}
