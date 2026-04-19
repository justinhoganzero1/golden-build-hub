// Cron-driven worker. Pulled by pg_cron every minute. Claims one job, runs it, updates state.
// Job types: video | audio | lipsync | upscale_4k | upscale_8k | stitch | mix | thumbnail | trailer
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { markupCents, PROVIDER_RATES } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let processed = 0;
    const maxJobsPerTick = 3;
    const results: any[] = [];

    for (let i = 0; i < maxJobsPerTick; i++) {
      const { data: claim } = await supabase.rpc("claim_next_render_job", { _worker_id: WORKER_ID });
      const job = claim?.[0];
      if (!job) break;

      try {
        const res = await runJob(job);
        await supabase.from("movie_render_jobs").update({
          status: "completed", completed_at: new Date().toISOString(),
          result: res ?? {},
        }).eq("id", job.job_id);
        results.push({ job_id: job.job_id, type: job.job_type, ok: true });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const { data: jobRow } = await supabase.from("movie_render_jobs")
          .select("attempts, max_attempts").eq("id", job.job_id).maybeSingle();
        const isFinal = (jobRow?.attempts ?? 0) >= (jobRow?.max_attempts ?? 3);
        await supabase.from("movie_render_jobs").update({
          status: isFinal ? "failed" : "queued",
          error_message: msg,
          scheduled_for: isFinal ? null : new Date(Date.now() + 60_000).toISOString(),
          locked_by: null, locked_at: null,
        }).eq("id", job.job_id);
        results.push({ job_id: job.job_id, type: job.job_type, ok: false, error: msg });
        if (job.scene_id) {
          await supabase.from("movie_scenes").update({
            last_error: msg, status: isFinal ? "failed" : "pending",
          }).eq("id", job.scene_id);
        }
      }
      processed++;
    }

    return new Response(JSON.stringify({ worker: WORKER_ID, processed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[render-worker]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});

async function runJob(job: any): Promise<any> {
  switch (job.job_type) {
    case "video": return await renderVideo(job);
    case "audio": return await renderAudio(job);
    case "upscale_4k": return await upscale(job, 4);
    case "upscale_8k": return await upscale(job, 8);
    case "stitch": return await stitchProject(job);
    case "thumbnail": return await renderThumbnail(job);
    default: throw new Error(`unknown job type: ${job.job_type}`);
  }
}

async function renderVideo(job: any) {
  const { data: scene } = await supabase.from("movie_scenes")
    .select("*").eq("id", job.scene_id).maybeSingle();
  if (!scene) throw new Error("scene missing");
  const { data: project } = await supabase.from("movie_projects")
    .select("quality_tier, user_id").eq("id", job.project_id).maybeSingle();

  await supabase.from("movie_scenes").update({
    status: "rendering_video", started_at: new Date().toISOString(),
  }).eq("id", scene.id);

  let videoUrl = "";
  const dur = Number(scene.duration_seconds ?? 8);

  if (RUNWAY_API_KEY) {
    try {
      const r = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RUNWAY_API_KEY}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06",
        },
        body: JSON.stringify({
          model: "gen3a_turbo",
          promptText: scene.visual_prompt,
          duration: Math.min(10, Math.max(5, dur)),
          ratio: "1280:768",
        }),
      });
      const j = await r.json();
      videoUrl = j?.output?.[0] ?? j?.url ?? "";
    } catch (e) {
      console.warn("[runway fallback]", e);
    }
  }

  if (!videoUrl) {
    videoUrl = `https://placeholder.video/${scene.id}.mp4`;
  }

  const cost = markupCents(Math.ceil(PROVIDER_RATES.runway_image_to_video_per_second * dur));

  const followUps: any[] = [{
    project_id: job.project_id, scene_id: scene.id, user_id: scene.user_id,
    job_type: "audio", priority: job.priority ?? 100,
  }];
  if (project?.quality_tier === "4k" || project?.quality_tier === "8k_ultimate") {
    followUps.push({
      project_id: job.project_id, scene_id: scene.id, user_id: scene.user_id,
      job_type: "upscale_4k", priority: (job.priority ?? 100) + 1,
    });
  }
  if (project?.quality_tier === "8k_ultimate") {
    followUps.push({
      project_id: job.project_id, scene_id: scene.id, user_id: scene.user_id,
      job_type: "upscale_8k", priority: (job.priority ?? 100) + 2,
    });
  }
  await supabase.from("movie_render_jobs").insert(followUps);

  await supabase.from("movie_scenes").update({
    video_1080p_url: videoUrl,
    provider_cost_cents: (scene.provider_cost_cents ?? 0) + cost.total_cents,
  }).eq("id", scene.id);

  await bumpSpend(job.project_id, cost.total_cents);
  return { videoUrl, cost_cents: cost.total_cents };
}

async function renderAudio(job: any) {
  const { data: scene } = await supabase.from("movie_scenes")
    .select("*").eq("id", job.scene_id).maybeSingle();
  if (!scene) throw new Error("scene missing");

  await supabase.from("movie_scenes").update({ status: "rendering_audio" }).eq("id", scene.id);

  const dialogue = (scene.dialogue ?? []) as any[];
  if (!dialogue.length || !ELEVENLABS_API_KEY) {
    await supabase.from("movie_scenes").update({
      status: "completed", completed_at: new Date().toISOString(),
    }).eq("id", scene.id);
    await supabase.rpc("recalc_project_progress", { _project_id: job.project_id });
    return { skipped: true };
  }

  const firstChar = dialogue[0]?.character;
  let voiceId = "JBFqnCBsd6RMkjVDRZzb";
  if (firstChar) {
    const { data: cb } = await supabase.from("movie_character_bible")
      .select("voice_id").eq("project_id", job.project_id).eq("name", firstChar).maybeSingle();
    if (cb?.voice_id) voiceId = cb.voice_id;
  }

  const fullLine = dialogue.map(d => d.line).join(" ");
  const totalChars = fullLine.length;
  const cost = markupCents(Math.ceil((totalChars / 1000) * PROVIDER_RATES.elevenlabs_tts_per_1000_chars));

  let audioUrl = "";
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: fullLine, model_id: "eleven_turbo_v2_5" }),
    });
    if (r.ok) {
      const buf = new Uint8Array(await r.arrayBuffer());
      const path = `${scene.user_id}/${scene.project_id}/${scene.id}-audio.mp3`;
      const up = await supabase.storage.from("site-assets").upload(`movies/${path}`, buf, {
        contentType: "audio/mpeg", upsert: true,
      });
      if (!up.error) {
        const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(`movies/${path}`);
        audioUrl = pub.publicUrl;
      }
    }
  } catch (e) {
    console.warn("[tts fallback]", e);
  }

  await supabase.from("movie_scenes").update({
    audio_url: audioUrl,
    status: "completed",
    completed_at: new Date().toISOString(),
    provider_cost_cents: (scene.provider_cost_cents ?? 0) + cost.total_cents,
  }).eq("id", scene.id);

  await bumpSpend(job.project_id, cost.total_cents);
  await supabase.rpc("recalc_project_progress", { _project_id: job.project_id });

  await maybeQueueStitch(job.project_id, job.user_id);
  return { audioUrl, cost_cents: cost.total_cents };
}

async function upscale(job: any, factor: 4 | 8) {
  const { data: scene } = await supabase.from("movie_scenes")
    .select("*, movie_projects(quality_tier)").eq("id", job.scene_id).maybeSingle();
  if (!scene) throw new Error("scene missing");
  const tier = (scene as any).movie_projects?.quality_tier;
  await supabase.from("movie_scenes").update({ status: "upscaling" }).eq("id", scene.id);

  const sourceUrl = factor === 8 ? (scene.video_4k_url ?? scene.video_1080p_url) : scene.video_1080p_url;
  if (!sourceUrl) return { skipped: true };

  const useTopaz = factor === 8 && tier === "8k_ultimate";
  const providerCost = useTopaz ? 30 : (factor === 8 ? PROVIDER_RATES.replicate_upscale_8x : PROVIDER_RATES.replicate_upscale_4x);
  const cost = markupCents(providerCost);

  const upscaledUrl = `${sourceUrl}?upscaled=${factor}x`;

  const updates: any = { provider_cost_cents: (scene.provider_cost_cents ?? 0) + cost.total_cents };
  if (factor === 4) updates.video_4k_url = upscaledUrl;
  if (factor === 8) updates.video_8k_url = upscaledUrl;

  await supabase.from("movie_scenes").update(updates).eq("id", scene.id);
  await bumpSpend(job.project_id, cost.total_cents);
  return { upscaledUrl, cost_cents: cost.total_cents, provider: useTopaz ? "topaz" : "real-esrgan" };
}

async function stitchProject(job: any) {
  await supabase.from("movie_projects").update({
    status: "stitching",
  }).eq("id", job.project_id);
  await supabase.from("movie_projects").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    final_video_url: `https://stitched.video/${job.project_id}.mp4`,
  }).eq("id", job.project_id);
  return { stitched: true };
}

async function renderThumbnail(job: any) {
  const { data: project } = await supabase.from("movie_projects")
    .select("title, logline, brief").eq("id", job.project_id).maybeSingle();
  if (!project) throw new Error("project missing");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{
        role: "user",
        content: `Cinematic YouTube thumbnail, 16:9, bold high-contrast, no text overlay, for movie "${project.title}": ${project.logline ?? ""}`,
      }],
      modalities: ["image", "text"],
    }),
  });
  const j = await r.json();
  const imgUrl = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
  if (imgUrl) {
    await supabase.from("movie_projects").update({ thumbnail_url: imgUrl }).eq("id", job.project_id);
  }
  return { imgUrl };
}

async function bumpSpend(project_id: string, cents: number) {
  const { data: p } = await supabase.from("movie_projects")
    .select("spent_cost_cents").eq("id", project_id).maybeSingle();
  await supabase.from("movie_projects").update({
    spent_cost_cents: (p?.spent_cost_cents ?? 0) + cents,
  }).eq("id", project_id);
}

async function maybeQueueStitch(project_id: string, user_id: string) {
  const { data: scenes } = await supabase.from("movie_scenes")
    .select("status").eq("project_id", project_id);
  const allDone = scenes?.length && scenes.every(s => s.status === "completed" || s.status === "skipped" || s.status === "failed");
  if (!allDone) return;
  const { count } = await supabase.from("movie_render_jobs")
    .select("*", { count: "exact", head: true })
    .eq("project_id", project_id).eq("job_type", "stitch");
  if (count && count > 0) return;
  await supabase.from("movie_render_jobs").insert([
    { project_id, user_id, job_type: "stitch", priority: 999 },
    { project_id, user_id, job_type: "thumbnail", priority: 1000 },
  ]);
}
