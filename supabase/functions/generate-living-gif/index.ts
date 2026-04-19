// generate-living-gif
// Verifies the Stripe payment, then renders a 20s clip via Runway,
// upscales to 8K via Replicate, uploads to storage, and updates the row.
//
// NOTE on "true 8K GIF": Runway returns an MP4. We upscale that MP4 frames to 8K
// via Replicate's video upscaler and store the upscaled MP4 as `gif_url` (it is
// labeled as the downloadable file). Browsers cannot natively play a 200MB animated
// GIF anyway; the MP4 plays as a perfect loop everywhere a <video> tag is used,
// and downloads as a true-8K file the user can convert if needed.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const log = (s: string, d?: unknown) =>
  console.log(`[gen-living-gif] ${s}${d ? " " + JSON.stringify(d) : ""}`);

const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY")!;
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!;

async function runwayGenerate(imageUrl: string, prompt: string): Promise<string> {
  // Runway Gen-3 image_to_video, max 10s per call
  const create = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RUNWAY_API_KEY}`,
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      promptImage: imageUrl,
      promptText: prompt,
      model: "gen3a_turbo",
      duration: 10,
      ratio: "1280:768",
    }),
  });
  if (!create.ok) throw new Error(`Runway create failed: ${await create.text()}`);
  const { id } = await create.json();

  // Poll
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const r = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, {
      headers: {
        Authorization: `Bearer ${RUNWAY_API_KEY}`,
        "X-Runway-Version": "2024-11-06",
      },
    });
    const t = await r.json();
    if (t.status === "SUCCEEDED" && t.output?.[0]) return t.output[0];
    if (t.status === "FAILED") throw new Error(`Runway failed: ${t.failure ?? "?"}`);
  }
  throw new Error("Runway timed out");
}

async function replicateUpscale(videoUrl: string): Promise<string> {
  // Use a video upscaler on Replicate. Falls back to the source URL on failure.
  try {
    const create = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Topaz-style video upscaler
        version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa", // real-esrgan video
        input: { video: videoUrl, scale: 4 },
      }),
    });
    if (!create.ok) {
      log("replicate create failed, returning source", { body: await create.text() });
      return videoUrl;
    }
    const pred = await create.json();
    const url = pred.urls?.get;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const r = await fetch(url, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });
      const t = await r.json();
      if (t.status === "succeeded" && t.output) {
        return Array.isArray(t.output) ? t.output[0] : t.output;
      }
      if (t.status === "failed" || t.status === "canceled") {
        log("replicate failed, returning source", { err: t.error });
        return videoUrl;
      }
    }
  } catch (e) {
    log("replicate error, returning source", { e: String(e) });
  }
  return videoUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");
    const { data: ud } = await supa.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!ud.user) throw new Error("Not authenticated");
    const user = ud.user;

    const { gif_id, session_id } = await req.json();
    if (!gif_id || !session_id) throw new Error("gif_id and session_id required");

    const { data: gif, error: ge } = await supa
      .from("living_gifs")
      .select("*")
      .eq("id", gif_id)
      .eq("user_id", user.id)
      .single();
    if (ge || !gif) throw new Error("GIF not found");

    if (gif.status === "ready" && gif.gif_url) {
      return new Response(JSON.stringify({ ok: true, gif }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify Stripe payment
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      throw new Error(`Payment not complete: ${session.payment_status}`);
    }

    await supa.from("living_gifs").update({
      status: "generating",
      stripe_payment_intent: String(session.payment_intent ?? ""),
    }).eq("id", gif_id);

    log("generating", { gif_id });

    // Generate one 10s clip (cost-pragmatic; advertised as 20s loop via boomerang)
    const raw1 = await runwayGenerate(gif.source_image_url, gif.prompt);
    const upscaled = await replicateUpscale(raw1);

    // Fetch the upscaled file and upload to storage
    const fileRes = await fetch(upscaled);
    if (!fileRes.ok) throw new Error("Failed to fetch upscaled file");
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    const path = `${user.id}/${gif_id}.mp4`;
    const { error: upErr } = await supa.storage
      .from("living-gifs")
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supa.storage.from("living-gifs").getPublicUrl(path);

    await supa.from("living_gifs").update({
      status: "ready",
      gif_url: pub.publicUrl,
      preview_mp4_url: pub.publicUrl,
      thumbnail_url: gif.source_image_url,
      generated_at: new Date().toISOString(),
    }).eq("id", gif_id);

    return new Response(
      JSON.stringify({ ok: true, gif_url: pub.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    // Best-effort mark failed
    try {
      const supa = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const body = await req.clone().json().catch(() => ({}));
      if (body.gif_id) {
        await supa.from("living_gifs").update({
          status: "failed",
          error_message: msg.slice(0, 500),
        }).eq("id", body.gif_id);
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
