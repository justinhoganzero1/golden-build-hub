// living-gif-worker
//
// Cron-driven (every minute) + on-demand worker that progresses one GIF per tick.
// Uses a non-blocking state machine so a single edge invocation never has to
// wait minutes for Runway / Replicate.
//
// Stages:
//   queued                 -> submit Runway task,  store runway_task_id, stage='runway_pending'
//   runway_pending         -> poll Runway. If done -> submit Replicate upscale, stage='replicate_pending'
//                                          else stay (will be picked up next tick)
//   replicate_pending      -> poll Replicate. If done -> mirror to storage, mark ready

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY")!;
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const WORKER_ID = `gif-worker-${crypto.randomUUID().slice(0, 8)}`;
const log = (s: string, d?: unknown) =>
  console.log(`[living-gif-worker:${WORKER_ID}] ${s}${d ? " " + JSON.stringify(d) : ""}`);

interface ClaimedGif {
  gif_id: string;
  user_id: string;
  source_image_url: string;
  prompt: string;
  pipeline_stage: string | null;
  runway_task_id: string | null;
  replicate_prediction_id: string | null;
  attempts: number;
}

function toRunwayImage(imageUrl: string): string {
  if (imageUrl?.startsWith?.("data:image/")) return imageUrl;
  if (imageUrl?.startsWith?.("https://")) return imageUrl;
  throw new Error(
    `Source image not Runway-compatible: "${(imageUrl ?? "").slice(0, 80)}"`,
  );
}

async function submitRunway(gif: ClaimedGif) {
  const promptImage = toRunwayImage(gif.source_image_url);
  const r = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RUNWAY_API_KEY}`,
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      promptImage,
      promptText: gif.prompt,
      model: "gen3a_turbo",
      duration: 10,
      ratio: "1280:768",
    }),
  });
  if (!r.ok) throw new Error(`Runway submit failed: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  if (!j.id) throw new Error("Runway returned no task id");

  await supa.from("living_gifs").update({
    pipeline_stage: "runway_pending",
    runway_task_id: j.id,
    last_progress_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    updated_at: new Date().toISOString(),
  }).eq("id", gif.gif_id);

  log("runway submitted", { gif_id: gif.gif_id, task: j.id });
}

async function pollRunway(gif: ClaimedGif): Promise<string | null> {
  const r = await fetch(`https://api.dev.runwayml.com/v1/tasks/${gif.runway_task_id}`, {
    headers: {
      Authorization: `Bearer ${RUNWAY_API_KEY}`,
      "X-Runway-Version": "2024-11-06",
    },
  });
  if (!r.ok) throw new Error(`Runway poll failed: ${(await r.text()).slice(0, 200)}`);
  const t = await r.json();
  if (t.status === "SUCCEEDED" && t.output?.[0]) return t.output[0] as string;
  if (t.status === "FAILED") throw new Error(`Runway failed: ${t.failure ?? "unknown"}`);
  return null;
}

async function submitReplicate(_gif: ClaimedGif, videoUrl: string): Promise<string> {
  if (!REPLICATE_API_TOKEN) return videoUrl;
  const r = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
      input: { video: videoUrl, scale: 4 },
    }),
  });
  if (!r.ok) {
    log("replicate submit failed — using runway output", { body: (await r.text()).slice(0, 200) });
    return videoUrl;
  }
  const j = await r.json();
  if (!j.id) return videoUrl;
  return `pending:${j.id}`;
}

async function pollReplicate(predictionId: string): Promise<string | null> {
  const r = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
  });
  if (!r.ok) throw new Error(`Replicate poll failed: ${(await r.text()).slice(0, 200)}`);
  const t = await r.json();
  if (t.status === "succeeded" && t.output) {
    return Array.isArray(t.output) ? t.output[0] : t.output;
  }
  if (t.status === "failed" || t.status === "canceled") {
    throw new Error(`Replicate failed: ${t.error ?? "unknown"}`);
  }
  return null;
}

async function finalize(gif: ClaimedGif, finalVideoUrl: string) {
  const fileRes = await fetch(finalVideoUrl);
  if (!fileRes.ok) throw new Error("Failed to fetch upscaled file");
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  const path = `${gif.user_id}/${gif.gif_id}.mp4`;
  const { error: upErr } = await supa.storage
    .from("living-gifs")
    .upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (upErr) throw upErr;
  const { data: pub } = supa.storage.from("living-gifs").getPublicUrl(path);

  await supa.from("living_gifs").update({
    status: "ready",
    pipeline_stage: "completed",
    gif_url: pub.publicUrl,
    preview_mp4_url: pub.publicUrl,
    generated_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    last_progress_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", gif.gif_id);

  log("finalized", { gif_id: gif.gif_id });
}

async function processOne(): Promise<{ processed: boolean; result?: unknown }> {
  const { data: claim, error } = await supa.rpc("claim_next_living_gif", {
    _worker_id: WORKER_ID,
  });
  if (error) throw error;
  const gif = (claim?.[0] ?? null) as ClaimedGif | null;
  if (!gif) return { processed: false };

  try {
    const stage = gif.pipeline_stage;

    if (!stage || stage === "queued") {
      await submitRunway(gif);
      return { processed: true, result: { stage: "runway_submitted", gif_id: gif.gif_id } };
    }

    if (stage === "runway_pending") {
      if (!gif.runway_task_id) throw new Error("runway_task_id missing");
      const videoUrl = await pollRunway(gif);
      if (!videoUrl) {
        await supa.from("living_gifs").update({
          locked_at: null,
          locked_by: null,
          last_progress_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", gif.gif_id);
        return { processed: true, result: { stage: "runway_polling", gif_id: gif.gif_id } };
      }
      const next = await submitReplicate(gif, videoUrl);
      if (next.startsWith("pending:")) {
        await supa.from("living_gifs").update({
          pipeline_stage: "replicate_pending",
          replicate_prediction_id: next.slice("pending:".length),
          status: "upscaling",
          last_progress_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        }).eq("id", gif.gif_id);
        return { processed: true, result: { stage: "replicate_submitted", gif_id: gif.gif_id } };
      }
      await finalize(gif, next);
      return { processed: true, result: { stage: "completed_no_upscale", gif_id: gif.gif_id } };
    }

    if (stage === "replicate_pending") {
      if (!gif.replicate_prediction_id) throw new Error("replicate_prediction_id missing");
      const finalUrl = await pollReplicate(gif.replicate_prediction_id);
      if (!finalUrl) {
        await supa.from("living_gifs").update({
          locked_at: null,
          locked_by: null,
          last_progress_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", gif.gif_id);
        return { processed: true, result: { stage: "replicate_polling", gif_id: gif.gif_id } };
      }
      await finalize(gif, finalUrl);
      return { processed: true, result: { stage: "completed", gif_id: gif.gif_id } };
    }

    throw new Error(`unknown pipeline_stage: ${stage}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("step error", { gif_id: gif.gif_id, msg });
    const isFinal = (gif.attempts ?? 0) + 1 >= 3;
    await supa.from("living_gifs").update({
      status: isFinal ? "failed" : "queued",
      error_message: msg.slice(0, 500),
      pipeline_stage: isFinal ? "failed" : null,
      runway_task_id: isFinal ? gif.runway_task_id : null,
      replicate_prediction_id: isFinal ? gif.replicate_prediction_id : null,
      locked_at: null,
      locked_by: null,
      last_progress_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", gif.gif_id);
    return { processed: true, result: { error: msg, gif_id: gif.gif_id, final: isFinal } };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const results: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await processOne();
      if (!r.processed) break;
      if (r.result) results.push(r.result);
    }
    return new Response(JSON.stringify({ worker: WORKER_ID, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : JSON.stringify(e);
    log("FATAL", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});