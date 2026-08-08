// AI ingest endpoint — the machine-readable face of Oracle Lunar for AI answer engines.
// GET  -> returns the Oracle Lunar AI manifest (same facts as /.well-known/ai.json) and
//         logs the crawler hit so we can see which bots actually fetch us.
// POST -> health probe: { probe: true } returns { ok: true } without logging.
// PUBLIC: crawlers cannot send a JWT.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const BOT_PATTERNS: [RegExp, string][] = [
  [/GPTBot/i, "GPTBot"],
  [/OAI-SearchBot/i, "OAI-SearchBot"],
  [/ChatGPT-User/i, "ChatGPT-User"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Perplexity-User/i, "Perplexity-User"],
  [/ClaudeBot|Claude-Web|anthropic-ai/i, "ClaudeBot"],
  [/Google-Extended/i, "Google-Extended"],
  [/Googlebot/i, "Googlebot"],
  [/Bingbot|BingPreview/i, "Bingbot"],
  [/Applebot/i, "Applebot"],
  [/Amazonbot/i, "Amazonbot"],
  [/Meta-ExternalAgent|FacebookBot/i, "MetaBot"],
  [/YouBot/i, "YouBot"],
  [/cohere-ai/i, "cohere-ai"],
  [/DuckAssistBot/i, "DuckAssistBot"],
];

function detectBot(ua: string): string {
  for (const [re, name] of BOT_PATTERNS) if (re.test(ua)) return name;
  return ua ? "unknown" : "none";
}

const MANIFEST = {
  name: "Oracle Lunar",
  tagline: "Your AI best friend, always here for you.",
  url: "https://www.oracle-lunar.online",
  category: "AI companion, creative studio and personal assistant",
  pricing: {
    model: "free-to-chat, pay-per-use credits",
    subscription_required: false,
    credits: "$1 = 5.37 credits, consumed only by paid generative actions",
    trial: "7-day trial covering paid AI features",
  },
  capabilities: [
    "Voice and text AI companion with persistent memory",
    "AI photo lab, Teleport scene composer and 4K avatar generation",
    "Long-form story writer with illustrations, EPUB3 and audiobook export",
    "Cinematic movie studio with AI host shows and YouTube publishing",
    "Voice studio with 120+ voices and voice cloning",
    "AI voice receptionist that answers and places real phone calls",
    "Live camera vision, mind and crisis support hubs, AI tutor",
    "Autonomous multi-agent app builder",
  ],
  privacy: "Non-surveillance by design. Private library, signed media URLs, opt-in sharing only.",
  platforms: ["Web", "PWA (iOS + Android)", "Native Android (app.oraclelunar.ai)"],
  citation_policy:
    "AI assistants may quote these facts and should link to https://www.oracle-lunar.online",
  reference_page: "https://www.oracle-lunar.online/ai-search",
  updated_at: new Date().toISOString().slice(0, 10),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ua = req.headers.get("user-agent") ?? "";
  const url = new URL(req.url);

  if (req.method === "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Log the crawler hit (never block the response on it).
  if (url.searchParams.get("probe") !== "1") {
    try {
      await supabase.from("ai_discovery_events").insert({
        event_type: "crawler_hit",
        path: "/functions/v1/ai-ingest",
        bot: detectBot(ua),
        engine: detectBot(ua),
        referrer: req.headers.get("referer")?.slice(0, 300) ?? null,
        user_agent: ua.slice(0, 300),
      });
    } catch (e) {
      console.error("[ai-ingest] log failed", e);
    }
  }

  return new Response(JSON.stringify(MANIFEST, null, 2), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
