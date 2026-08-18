// Compile a stack of up to 16 base64 images into a vertical marketing video.
// Uses Shotstack render API (already configured via SHOTSTACK_API_KEY).
// Each image gets `per_image_seconds` of screen time with a Ken-Burns zoom + fade.
// The compiled MP4 is returned as `video_url` and saved to the user's library by the client.
//
// BILLING: provider-billed (Shotstack per second rendered + platform margin).
// The caller must be signed in and is charged via a two-phase hold/settle so a
// failed render never costs the user anything.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";
import {
  authorizeAI,
  settleAI,
  cancelAI,
  InsufficientCoinsError,
  insufficientCoinsResponse,
} from "../_shared/wallet.ts";
import { PROVIDER_RATES } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOTSTACK_API_KEY = Deno.env.get("SHOTSTACK_API_KEY") ?? "";
const SHOTSTACK_PROD_API_KEY = Deno.env.get("SHOTSTACK_PROD_API_KEY") ?? "";
const SHOTSTACK_ENV = (Deno.env.get("SHOTSTACK_ENV") ?? "stage").toLowerCase();
const KEY = SHOTSTACK_ENV === "v1" || SHOTSTACK_ENV === "prod"
  ? (SHOTSTACK_PROD_API_KEY || SHOTSTACK_API_KEY)
  : SHOTSTACK_API_KEY;
const HOST = SHOTSTACK_ENV === "v1" || SHOTSTACK_ENV === "prod"
  ? "https://api.shotstack.io/v1"
  : "https://api.shotstack.io/stage";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  images: string[]; // data URLs or https URLs
  title?: string;
  per_image_seconds?: number;
  aspect?: "9:16" | "16:9" | "1:1";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let hold: { transactionId: string } | null = null;
  let settled = false;
  let estimate = 0;

  try {
    if (!KEY) throw new Error("SHOTSTACK_API_KEY not configured");

    // Signed-in users only — this endpoint spends real provider money.
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const rl = await enforceRateLimit(req, auth.user, "compile-marketing-video");
    if (rl) return rl;

    const body: Body = await req.json();
    const images = (body.images ?? []).filter(Boolean).slice(0, 16);
    if (images.length < 2) throw new Error("Need at least 2 images.");
    const per = Math.max(1, Math.min(6, body.per_image_seconds ?? 2.5));

    // Hold the estimated render cost before we submit to Shotstack.
    const totalSeconds = Math.ceil(images.length * per);
    estimate = Math.max(1, totalSeconds * PROVIDER_RATES.shotstack_render_per_second);
    try {
      hold = await authorizeAI(auth.user.id, "compile-marketing-video", estimate, {
        provider: "shotstack",
        seconds: totalSeconds,
        images: images.length,
        aspect: body.aspect ?? "9:16",
      });
    } catch (billErr) {
      if (billErr instanceof InsufficientCoinsError) return insufficientCoinsResponse(billErr, corsHeaders);
      throw billErr;
    }


    // 1) Upload any data: URLs to Supabase storage so Shotstack can fetch them.
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const hostedUrls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const src = images[i];
      if (src.startsWith("http")) { hostedUrls.push(src); continue; }
      const m = src.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      if (!m) { hostedUrls.push(src); continue; }
      const ext = m[1].split("/")[1].replace("+xml", "");
      const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      const path = `marketing-reels/${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("photography-assets")
        .upload(path, bin, { contentType: m[1], upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("photography-assets").getPublicUrl(path);
      hostedUrls.push(data.publicUrl);
    }

    // 2) Build the Shotstack timeline.
    const aspect = body.aspect ?? "9:16";
    const resolution = aspect === "9:16" ? "sd" : "sd"; // 720p baseline keeps cost low
    const clips = hostedUrls.map((url, i) => ({
      asset: { type: "image", src: url },
      start: i * per,
      length: per,
      effect: i % 2 === 0 ? "zoomIn" : "zoomOut",
      transition: { in: "fade", out: "fade" },
      fit: "cover",
    }));

    const payload = {
      timeline: {
        background: "#000000",
        tracks: [{ clips }],
      },
      output: {
        format: "mp4",
        resolution,
        aspectRatio: aspect,
        fps: 25,
      },
    };

    // 3) Submit render.
    const renderResp = await fetch(`${HOST}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY },
      body: JSON.stringify(payload),
    });
    const renderJson = await renderResp.json();
    if (!renderResp.ok) throw new Error(JSON.stringify(renderJson));
    const renderId = renderJson?.response?.id;
    if (!renderId) throw new Error("No render id from Shotstack.");

    // 4) Poll for the final URL (max ~60s).
    let finalUrl: string | null = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusResp = await fetch(`${HOST}/render/${renderId}`, {
        headers: { "x-api-key": KEY },
      });
      const statusJson = await statusResp.json();
      const status = statusJson?.response?.status;
      if (status === "done") { finalUrl = statusJson.response.url; break; }
      if (status === "failed") throw new Error(statusJson?.response?.error || "Shotstack render failed.");
    }
    if (!finalUrl) throw new Error("Render timed out — try fewer images.");

    // Render delivered — settle the hold at the estimated amount.
    if (hold) { await settleAI(hold.transactionId, estimate); settled = true; }

    return new Response(JSON.stringify({ video_url: finalUrl, render_id: renderId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compile-marketing-video error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    // Failed / timed-out renders release the hold — the user is never charged.
    if (hold && !settled) {
      try { await cancelAI(hold.transactionId, "render_failed"); } catch (_) { /* best effort */ }
    }
  }
});

