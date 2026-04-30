// Replicate upscaler — Real-ESRGAN (4x) for true 4K/8K upscaling.
// Input:  { image_url: string, scale?: 2 | 4 | 8, face_enhance?: boolean }
// Output: { image_url: string }  (Replicate-hosted PNG/JPG)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PROVIDER_RATES } from "../_shared/pricing.ts";
import { chargeAI, getUserFromRequest, InsufficientCoinsError, insufficientCoinsResponse } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Real-ESRGAN model version (nightmareai/real-esrgan)
const MODEL_VERSION = "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "auth_required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { image_url, scale = 4, face_enhance = false } = await req.json() as {
      image_url?: string; scale?: number; face_enhance?: boolean;
    };

    if (!image_url || typeof image_url !== "string") {
      return new Response(JSON.stringify({ error: "image_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      return new Response(JSON.stringify({
        error: "REPLICATE_API_TOKEN missing",
        hint: "Add a Replicate API token in project secrets to enable 4K/8K upscaling.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Coin paywall — 8x runs the upscaler twice
    const providerCost = scale >= 8 ? PROVIDER_RATES.replicate_upscale_8x : PROVIDER_RATES.replicate_upscale_4x;
    try {
      await chargeAI(user.id, "replicate_upscale", providerCost, { scale, face_enhance });
    } catch (e) {
      if (e instanceof InsufficientCoinsError) return insufficientCoinsResponse(e, corsHeaders);
      throw e;
    }

    // Real-ESRGAN supports 2x/4x natively. For 8x, we run 4x then 2x.
    const runOnce = async (input_url: string, s: number): Promise<string> => {
      const submit = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: MODEL_VERSION,
          input: { image: input_url, scale: s, face_enhance },
        }),
      });
      if (!submit.ok) {
        const t = await submit.text();
        throw new Error(`Replicate submit ${submit.status}: ${t}`);
      }
      const j = await submit.json();
      const getUrl: string | undefined = j.urls?.get;
      if (!getUrl) throw new Error("No prediction url from Replicate");

      const startedAt = Date.now();
      while (Date.now() - startedAt < 240_000) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await fetch(getUrl, { headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` } });
        if (!poll.ok) continue;
        const pj = await poll.json();
        if (pj.status === "succeeded") {
          const out = Array.isArray(pj.output) ? pj.output[0] : pj.output;
          if (typeof out !== "string") throw new Error("Unexpected Replicate output shape");
          return out;
        }
        if (pj.status === "failed" || pj.status === "canceled") {
          throw new Error(`Replicate ${pj.status}: ${pj.error || "unknown"}`);
        }
      }
      throw new Error("Replicate timed out");
    };

    let outUrl: string;
    if (scale >= 8) {
      const step1 = await runOnce(image_url, 4);
      outUrl = await runOnce(step1, 2);
    } else if (scale >= 4) {
      outUrl = await runOnce(image_url, 4);
    } else {
      outUrl = await runOnce(image_url, 2);
    }

    return new Response(JSON.stringify({ image_url: outUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("replicate-upscale error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
