// AI-search discovery analytics.
// Tracks where visitors arrive from (ChatGPT, Perplexity, Gemini, Copilot, Claude, Google AI
// Overviews…), what they searched for, and whether that visit later converted into a signup
// or a wallet top-up. Everything is best-effort — analytics must never break the UI.
import { supabase } from "@/integrations/supabase/client";

export type AiDiscoveryEvent =
  | "visit"          // a human landed on an AI-discovery page
  | "signup"         // that visitor created an account
  | "topup_started"  // that visitor opened Stripe checkout for credits
  | "topup"          // top-up completed (recorded server-side by the Stripe webhook)
  | "crawler_hit";   // an AI crawler fetched a machine-readable endpoint

const ATTRIBUTION_KEY = "ol_ai_attribution_v1";

export interface AiAttribution {
  engine: string;
  referrer: string;
  path: string;
  query_hint: string | null;
  at: string;
}

/** Known AI answer engines, matched against document.referrer. */
const ENGINE_PATTERNS: [RegExp, string][] = [
  [/chat\.openai\.com|chatgpt\.com|openai\.com/i, "chatgpt"],
  [/perplexity\.ai/i, "perplexity"],
  [/gemini\.google\.com|bard\.google\.com/i, "gemini"],
  [/copilot\.microsoft\.com|bing\.com\/chat/i, "copilot"],
  [/claude\.ai|anthropic\.com/i, "claude"],
  [/you\.com/i, "you"],
  [/phind\.com/i, "phind"],
  [/poe\.com/i, "poe"],
  [/duckduckgo\.com/i, "duckduckgo"],
  [/bing\.com/i, "bing"],
  [/google\./i, "google"],
];

export function detectEngine(referrer: string, search = ""): string {
  const forced = new URLSearchParams(search).get("ai_src");
  if (forced) return forced.slice(0, 40);
  for (const [re, name] of ENGINE_PATTERNS) if (re.test(referrer)) return name;
  return referrer ? "other_referral" : "direct";
}

/** Pull a search phrase out of the URL when the engine passes one through. */
export function detectQueryHint(search: string): string | null {
  const p = new URLSearchParams(search);
  const q = p.get("q") || p.get("query") || p.get("utm_term") || p.get("ai_q");
  return q ? q.slice(0, 200) : null;
}

export function getAttribution(): AiAttribution | null {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as AiAttribution) : null;
  } catch {
    return null;
  }
}

/** Stores the FIRST AI-search touch so later conversions can be attributed to it. */
function rememberAttribution(a: AiAttribution) {
  try {
    if (!localStorage.getItem(ATTRIBUTION_KEY)) {
      localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(a));
    }
  } catch {
    /* private mode — ignore */
  }
}

export async function trackAiDiscovery(
  event_type: AiDiscoveryEvent,
  extra?: { amount_cents?: number; path?: string },
): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    const referrer = document.referrer || "";
    const search = window.location.search;
    const live = {
      engine: detectEngine(referrer, search),
      referrer: referrer.slice(0, 300),
      path: extra?.path ?? window.location.pathname,
      query_hint: detectQueryHint(search),
      at: new Date().toISOString(),
    };

    if (event_type === "visit") rememberAttribution(live);

    // Conversions are credited to the first touch when we have one.
    const attributed = event_type === "visit" ? live : getAttribution() ?? live;
    const { data: auth } = await supabase.auth.getUser();

    await supabase.from("ai_discovery_events").insert({
      event_type,
      path: live.path,
      engine: attributed.engine,
      referrer: attributed.referrer,
      query_hint: attributed.query_hint,
      user_agent: navigator.userAgent.slice(0, 300),
      user_id: auth?.user?.id ?? null,
      amount_cents: extra?.amount_cents ?? null,
    });
  } catch (err) {
    console.warn("[aiDiscovery] failed", event_type, err);
  }
}
