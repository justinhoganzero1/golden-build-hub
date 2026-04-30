import { PROVIDER_RATES } from "../_shared/pricing.ts";
import { chargeAI, getUserFromRequest, InsufficientCoinsError, insufficientCoinsResponse } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "auth_required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ fallback: true, reason: "no_api_key", error: "ElevenLabs API key not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, duration_seconds } = await req.json().catch(() => ({}));
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ fallback: true, reason: "bad_request", error: "prompt is required" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ms = Math.max(10000, Math.min(300000, (Number(duration_seconds) || 30) * 1000));

    const segments = Math.max(1, Math.ceil(ms / 30000));
    const providerCost = PROVIDER_RATES.elevenlabs_music_per_30s * segments;
    try {
      await chargeAI(user.id, "elevenlabs_music", providerCost, { duration_ms: ms });
    } catch (e) {
      if (e instanceof InsufficientCoinsError) return insufficientCoinsResponse(e, corsHeaders);
      throw e;
    }

    const resp = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.substring(0, 2000),
        music_length_ms: ms,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("ElevenLabs Music error:", err);
      return new Response(JSON.stringify({ fallback: true, reason: "upstream_error", status: resp.status, error: "Music generation failed", details: err }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(resp.body, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("Music error:", e);
    return new Response(JSON.stringify({ fallback: true, reason: "exception", error: e instanceof Error ? e.message : "Internal server error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
