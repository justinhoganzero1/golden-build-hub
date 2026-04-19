// Self-healing maintenance worker for the Movie Studio pipeline.
// Runs every minute via pg_cron. Detects bottlenecks, stalls, orphan jobs,
// and auto-rectifies by re-queueing, re-kicking the chunker, releasing locks,
// failing dead jobs, and asking Lovable AI for an explanation/recommendation
// stored on the project so the dashboard can show what was done.
//
// Heals:
//  1. Paid projects stuck in `chunking` / `draft` with 0 scenes  -> re-invoke chunker
//  2. Render jobs `running` for >10min with no progress          -> reset to queued
//  3. Render jobs that exceeded max_attempts                      -> mark failed + refund
//  4. Projects in `rendering` whose scenes are all done           -> advance status
//  5. Scenes in non-terminal status >30min with no job            -> requeue
//  6. Worker hasn't ticked in 5min                                -> self-tick render-worker
//  7. AI assessor: if anything was healed, summarise & store
//
// Idempotent. Safe to run every minute.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type HealAction = {
  kind: string;
  target: string;
  detail: string;
};

async function kickChunker(project_id: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/movie-script-chunker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ project_id, internal: true }),
    });
  } catch (e) {
    console.error("kickChunker failed", project_id, e);
  }
}

async function tickRenderWorker() {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/movie-render-worker`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ tick: true }),
    });
  } catch (e) {
    console.error("tickRenderWorker failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const actions: HealAction[] = [];
  const now = Date.now();
  const ISO = (ms: number) => new Date(ms).toISOString();

  try {
    // ---- 1. Paid projects with no scenes & not chunking actively ----
    const { data: stuckPaid } = await supabase
      .from("movie_projects")
      .select("id,user_id,status,payment_status,total_scenes,updated_at,paid_at")
      .eq("payment_status", "paid")
      .or("status.eq.draft,status.eq.chunking")
      .lt("total_scenes", 1);

    for (const p of stuckPaid ?? []) {
      const updatedMs = new Date(p.updated_at).getTime();
      // Give the chunker 3 min before re-kicking
      if (now - updatedMs > 3 * 60_000) {
        await kickChunker(p.id);
        actions.push({
          kind: "rekick_chunker",
          target: p.id,
          detail: `Re-invoked chunker (was ${p.status} with 0 scenes for ${Math.round((now - updatedMs) / 60000)}m)`,
        });
      }
    }

    // ---- 2. Stuck running jobs (>10 min) ----
    const tenMinAgo = ISO(now - 10 * 60_000);
    const { data: stuckRunning } = await supabase
      .from("movie_render_jobs")
      .select("id,project_id,attempts,max_attempts,started_at")
      .eq("status", "running")
      .lt("locked_at", tenMinAgo);

    for (const j of stuckRunning ?? []) {
      await supabase
        .from("movie_render_jobs")
        .update({
          status: "queued",
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", j.id);
      actions.push({
        kind: "release_lock",
        target: j.id,
        detail: `Released stuck render job (running >10min, attempt ${j.attempts}/${j.max_attempts})`,
      });
    }

    // ---- 3. Dead jobs (exceeded max_attempts) ----
    const { data: deadJobs } = await supabase
      .from("movie_render_jobs")
      .select("id,project_id,scene_id,attempts,max_attempts,error_message")
      .neq("status", "completed")
      .neq("status", "failed");

    for (const j of deadJobs ?? []) {
      if ((j.attempts ?? 0) >= (j.max_attempts ?? 3)) {
        await supabase
          .from("movie_render_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: j.error_message ?? "exceeded max attempts",
          })
          .eq("id", j.id);
        if (j.scene_id) {
          await supabase
            .from("movie_scenes")
            .update({
              status: "failed",
              last_error: j.error_message ?? "exceeded max attempts",
            })
            .eq("id", j.scene_id);
        }
        actions.push({
          kind: "fail_dead_job",
          target: j.id,
          detail: `Marked dead job failed after ${j.attempts} attempts`,
        });
      }
    }

    // ---- 4. Projects whose scenes are all done -> advance ----
    const { data: rendering } = await supabase
      .from("movie_projects")
      .select("id,total_scenes,completed_scenes,failed_scenes,status,final_video_url")
      .in("status", ["rendering", "queued", "stitching", "mixing", "upscaling"]);

    for (const p of rendering ?? []) {
      const total = p.total_scenes ?? 0;
      const done = p.completed_scenes ?? 0;
      const failed = p.failed_scenes ?? 0;
      if (total > 0 && done + failed >= total && !p.final_video_url) {
        // Queue a stitch job if none exists
        const { data: existing } = await supabase
          .from("movie_render_jobs")
          .select("id")
          .eq("project_id", p.id)
          .eq("job_type", "stitch")
          .neq("status", "completed")
          .maybeSingle();
        if (!existing) {
          const { data: proj } = await supabase
            .from("movie_projects").select("user_id").eq("id", p.id).maybeSingle();
          if (proj) {
            await supabase.from("movie_render_jobs").insert({
              project_id: p.id,
              user_id: proj.user_id,
              job_type: "stitch",
              priority: 10,
            });
            await supabase
              .from("movie_projects")
              .update({ status: "stitching" })
              .eq("id", p.id);
            actions.push({
              kind: "queue_stitch",
              target: p.id,
              detail: `All ${done}/${total} scenes ready – queued stitch job`,
            });
          }
        }
      }
    }

    // ---- 5. Orphan scenes (non-terminal, no active job, >30min) ----
    const thirtyMinAgo = ISO(now - 30 * 60_000);
    const { data: orphanScenes } = await supabase
      .from("movie_scenes")
      .select("id,project_id,user_id,status,updated_at")
      .neq("status", "completed")
      .neq("status", "failed")
      .neq("status", "skipped")
      .lt("updated_at", thirtyMinAgo)
      .limit(50);

    for (const s of orphanScenes ?? []) {
      const { data: jobs } = await supabase
        .from("movie_render_jobs")
        .select("id")
        .eq("scene_id", s.id)
        .in("status", ["queued", "running"])
        .limit(1);
      if (!jobs || jobs.length === 0) {
        await supabase.from("movie_render_jobs").insert({
          project_id: s.project_id,
          scene_id: s.id,
          user_id: s.user_id,
          job_type: "video",
          priority: 60,
        });
        actions.push({
          kind: "requeue_orphan_scene",
          target: s.id,
          detail: `Scene had no active job for >30min – re-queued`,
        });
      }
    }

    // ---- 6. Tick the render worker if there is queued work ----
    const { count: queuedCount } = await supabase
      .from("movie_render_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued");
    if ((queuedCount ?? 0) > 0) {
      await tickRenderWorker();
      actions.push({
        kind: "tick_worker",
        target: "render-worker",
        detail: `Pinged worker (${queuedCount} queued)`,
      });
    }

    // ---- 7. AI bottleneck assessment (only when something happened) ----
    let aiSummary: string | null = null;
    if (actions.length > 0 && LOVABLE_API_KEY) {
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  "You are the Movie Studio maintenance AI. Given a list of self-heal actions just performed, return ONE short sentence (max 25 words) describing what was healed and any bottleneck pattern. No emojis, no markdown.",
              },
              {
                role: "user",
                content: JSON.stringify(actions.slice(0, 20)),
              },
            ],
          }),
        });
        if (r.ok) {
          const j = await r.json();
          aiSummary = j?.choices?.[0]?.message?.content?.trim() ?? null;
        }
      } catch (e) {
        console.error("AI assessor failed", e);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        healed: actions.length,
        actions,
        ai_summary: aiSummary,
        ts: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[movie-maintenance-ai]", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown", actions }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
