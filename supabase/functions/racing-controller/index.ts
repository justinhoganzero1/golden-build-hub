// Oracle Racing — Master Controller (owner-only).
// Coordinates the seven engines, records every run honestly in
// racing_engine_runs, schedules race-day jobs and never invents data:
// engines without a connected, authorised source report
// "awaiting_configuration" or "waiting_for_data" instead of pretending.
// Called by the owner from the control room, or every 5 minutes by the
// database scheduler (x-internal-job-token).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.25.76";
import { requireOwner } from "../_shared/requireAuth.ts";
import { hasSchedulerToken } from "../_shared/internalAuth.ts";
import { suitabilityScore, selectRaces, raceDayJobs, scorePrediction, type SelectionMode } from "../_shared/racingLogic.ts";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.9";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-job-token",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const ENGINES = ["discovery", "historical", "paddock_vision", "environment", "dynamics", "race_vision", "training_vision", "master"] as const;
type Engine = typeof ENGINES[number];

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("run"), engine: z.enum(ENGINES).optional() }),
  z.object({ action: z.literal("tick") }),
  z.object({ action: z.literal("save_credentials"), provider_id: z.string().min(1).max(60), values: z.record(z.string().max(500)) }),
  z.object({ action: z.literal("clear_credentials"), provider_id: z.string().min(1).max(60) }),
  z.object({
    action: z.literal("analyse_clip"),
    video_id: z.string().uuid(),
    frames: z.array(z.string().startsWith("data:image/jpeg;base64,").max(400_000)).min(1).max(8),
  }),
]);

const VISION_MODEL = "openai/gpt-6-astra" as const;
const PARADE_RULES = `You are Oracle Racing's paddock vision engine. You are shown still frames from ONE short clip the owner filmed of horses parading before a race.
Describe only what is visible. Never guess a horse's name, never predict a winner, never invent anything you cannot see.
For each horse you can see clearly, report: a visible label (saddlecloth number if readable, otherwise colours/position), calmness (calm / alert / on edge / agitated), visible sweating (none / light / heavy / unclear), coat (shining / normal / dull / unclear), walk (relaxed and even / short or choppy / unclear), and one short plain-English note.
Also rate overall clip quality (good / fair / poor) and your confidence from 0 to 1.
Reply with JSON only, shaped like {"quality":"fair","confidence":0.5,"overall":"...","horses":[{"label":"...","calmness":"...","sweating":"...","coat":"...","walk":"...","note":"..."}]}`;

function outputText(res: unknown): string {
  const r = res as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  const parts: string[] = [];
  for (const item of r.output ?? []) for (const c of item.content ?? []) if (c.type === "output_text" && c.text) parts.push(c.text);
  return parts.join("");
}

/** Owner-uploaded parade clip → AI observations (labelled interpretation, never a prediction). */
async function analyseClip(sb: SupabaseClient, actor: string, videoId: string, frames: string[]) {
  const { data: video } = await sb.from("racing_video_sources").select("id,race_id,kind,storage_path").eq("id", videoId).maybeSingle();
  if (!video || !video.storage_path) return { error: "unknown_clip", status: 404 };
  const content: any[] = [{ type: "input_text", text: `${frames.length} frames from the clip, in time order.` }];
  for (const f of frames) content.push({ type: "input_image", image_url: f, detail: "auto" });
  let parsed: any;
  try {
    const res = await generateResponse({ model: VISION_MODEL, instructions: PARADE_RULES, input: [{ role: "user", content }], reasoning: { effort: "low" } } as any, { maxRetries: 0 });
    const text = outputText(res);
    const m = text.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : null;
  } catch (e) {
    const msg = e instanceof GatewayError ? `${e.code}: ${e.message}` : (e as Error).message;
    console.error("racing analyse_clip", msg);
    return { error: "analysis_failed", detail: msg.slice(0, 200), status: 502 };
  }
  if (!parsed || !Array.isArray(parsed.horses)) return { error: "analysis_unreadable", status: 502 };
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const quality = ["good", "fair", "poor"].includes(parsed.quality) ? parsed.quality : "unclear";
  const now = new Date().toISOString();
  const rows = parsed.horses.slice(0, 30).map((h: any) => ({
    video_id: video.id, race_id: video.race_id, observed_at: now, available: true, confidence,
    objective_measures: {
      label: String(h.label ?? "").slice(0, 80), calmness: String(h.calmness ?? "unclear").slice(0, 30),
      sweating: String(h.sweating ?? "unclear").slice(0, 30), coat: String(h.coat ?? "unclear").slice(0, 30),
      walk: String(h.walk ?? "unclear").slice(0, 40), source: "owner_upload", frames: frames.length,
    },
    ai_interpretation: String(h.note ?? "").slice(0, 400),
  }));
  if (!rows.length) rows.push({ video_id: video.id, race_id: video.race_id, observed_at: now, available: false, confidence, objective_measures: { source: "owner_upload", frames: frames.length }, ai_interpretation: String(parsed.overall ?? "No horse was clear enough to describe.").slice(0, 400) });
  await sb.from("racing_visual_observations").insert(rows);
  await sb.from("racing_video_sources").update({ quality, identification_confidence: confidence }).eq("id", video.id);
  await sb.from("racing_providers").update({ status: "connected", last_success_at: now, last_checked_at: now, updated_at: now }).eq("id", "owner-uploads");
  await sb.from("racing_audit_log").insert({ actor, action: "clip_analysed", detail: { video: video.id, horses: rows.length, quality } });
  return { ok: true, horses: rows.length, quality, confidence, overall: String(parsed.overall ?? "").slice(0, 400) };
}

function db(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

async function startRun(sb: SupabaseClient, engine: Engine, task: string, trigger: string) {
  const { data } = await sb.from("racing_engine_runs").insert({ engine, status: "running", task, trigger }).select("id").single();
  return data?.id as string | undefined;
}
async function finishRun(sb: SupabaseClient, id: string | undefined, status: string, detail: Record<string, unknown>, error?: string) {
  if (!id) return;
  await sb.from("racing_engine_runs").update({ status, detail, error: error ?? null, progress: status === "running" ? 50 : 100, finished_at: new Date().toISOString() }).eq("id", id);
}

async function connectedRacingProviders(sb: SupabaseClient) {
  const { data: providers } = await sb.from("racing_providers").select("id,name,category,adapter_ready");
  const { data: creds } = await sb.from("racing_provider_credentials").select("provider_id");
  const withCreds = new Set((creds ?? []).map((c) => c.provider_id));
  return (providers ?? []).map((p) => ({ ...p, has_credentials: withCreds.has(p.id) }));
}

// ---------- Engine 4: environment (real, free Open-Meteo) ----------
async function runEnvironment(sb: SupabaseClient, trigger: string, force: boolean) {
  if (!force) {
    const { data: last } = await sb.from("racing_engine_runs").select("started_at").eq("engine", "environment").eq("status", "succeeded")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - new Date(last.started_at).getTime() < 55 * 60_000) return { skipped: true };
  }
  const runId = await startRun(sb, "environment", "Refresh weather at racecourses", trigger);
  try {
    const { data: courses } = await sb.from("racing_racecourses").select("id,name,latitude,longitude").not("latitude", "is", null);
    const list = courses ?? [];
    if (!list.length) { await finishRun(sb, runId, "waiting_for_data", { reason: "No racecourses with locations." }); return { ok: false }; }
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", list.map((c) => c.latitude).join(","));
    url.searchParams.set("longitude", list.map((c) => c.longitude).join(","));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation");
    url.searchParams.set("hourly", "precipitation");
    url.searchParams.set("past_days", "1");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "UTC");
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const rows = arr.map((w: any, i: number) => {
      const hourly: number[] = w?.hourly?.precipitation ?? [];
      const rain24 = hourly.slice(0, 24).reduce((a, b) => a + (Number(b) || 0), 0);
      return {
        racecourse_id: list[i].id,
        observed_for: w?.current?.time ? new Date(`${w.current.time}Z`).toISOString() : new Date().toISOString(),
        kind: "model_current",
        temperature_c: w?.current?.temperature_2m ?? null,
        humidity_pct: w?.current?.relative_humidity_2m ?? null,
        wind_kph: w?.current?.wind_speed_10m ?? null,
        wind_direction_deg: w?.current?.wind_direction_10m ?? null,
        rain_mm: Math.round(rain24 * 10) / 10,
        source: "open-meteo",
        raw: { current: w?.current ?? null, rain_last_24h_mm: rain24 },
      };
    }).filter((r) => r.temperature_c !== null);
    if (rows.length) await sb.from("racing_weather_observations").insert(rows);
    await sb.from("racing_weather_observations").delete().lt("created_at", new Date(Date.now() - 14 * 86_400_000).toISOString());
    await sb.from("racing_providers").update({ status: "connected", last_success_at: new Date().toISOString(), last_checked_at: new Date().toISOString(), last_error: null }).eq("id", "open-meteo");
    await finishRun(sb, runId, "succeeded", { racecourses: rows.length, note: "Forecast-model conditions, not official track ratings." });
    return { ok: true, racecourses: rows.length };
  } catch (e) {
    const msg = (e as Error).message;
    await sb.from("racing_providers").update({ status: "error", last_checked_at: new Date().toISOString(), last_error: msg.slice(0, 500) }).eq("id", "open-meteo");
    await finishRun(sb, runId, "failed", {}, msg.slice(0, 500));
    return { ok: false, error: msg };
  }
}

// ---------- Engine 1: discovery ----------
async function runDiscovery(sb: SupabaseClient, trigger: string) {
  const providers = (await connectedRacingProviders(sb)).filter((p) => p.category === "racing_data" || p.category === "markets");
  const usable = providers.filter((p) => p.has_credentials && p.adapter_ready);
  const runId = await startRun(sb, "discovery", "Find races worldwide", trigger);
  if (!usable.length) {
    const pending = providers.filter((p) => p.has_credentials && !p.adapter_ready).map((p) => p.name);
    await finishRun(sb, runId, "awaiting_configuration", {
      reason: pending.length
        ? `Keys saved for ${pending.join(", ")}, but the connection for that provider still has to be built from its official documentation.`
        : "No licensed racing data provider is connected yet. Races are not invented.",
      providers_checked: providers.length,
    });
    return { ok: false };
  }
  // Adapters are added per provider once its official documentation is available.
  await finishRun(sb, runId, "awaiting_configuration", { reason: "Provider adapter not yet available." });
  return { ok: false };
}

// ---------- Engines 2 and 5: data-driven analysis ----------
async function runDataEngine(sb: SupabaseClient, engine: "historical" | "dynamics", trigger: string) {
  const runId = await startRun(sb, engine, engine === "historical" ? "Analyse past performances" : "Jockeys, trainers, breeding, pace", trigger);
  const { count: runners } = await sb.from("racing_runners").select("id", { count: "exact", head: true });
  const { count: perfs } = await sb.from("racing_performances").select("id", { count: "exact", head: true });
  if (!runners || !perfs) {
    await finishRun(sb, runId, "waiting_for_data", { runners: runners ?? 0, performances: perfs ?? 0, reason: "No race fields or past performances stored yet." });
    return;
  }
  await finishRun(sb, runId, "waiting_for_data", { runners, performances: perfs, reason: "Analysis model is built once a data provider supplies enough history to test." });
}

// ---------- Engines 3, 6, 7: vision ----------
async function runVisionEngine(sb: SupabaseClient, engine: "paddock_vision" | "race_vision" | "training_vision", trigger: string) {
  const kinds = engine === "paddock_vision" ? ["paddock"] : engine === "race_vision" ? ["race"] : ["training", "trial", "warmup", "owner_upload"];
  const runId = await startRun(sb, engine, "Look for authorised footage", trigger);
  const { count } = await sb.from("racing_video_sources").select("id", { count: "exact", head: true }).in("kind", kinds);
  const { data: vid } = await sb.from("racing_providers").select("status").eq("id", "licensed-video").maybeSingle();
  if (!count) {
    await finishRun(sb, runId, vid?.status === "connected" ? "waiting_for_data" : "awaiting_configuration", {
      footage: 0,
      reason: "No authorised footage connected. Observations are marked unavailable, never guessed.",
    });
    return;
  }
  const { count: observed } = await sb.from("racing_visual_observations").select("id", { count: "exact", head: true }).not("video_id", "is", null);
  await finishRun(sb, runId, observed ? "succeeded" : "waiting_for_data", {
    footage: count, observations: observed ?? 0,
    reason: observed
      ? `${count} clip(s) stored, ${observed} horse observation(s) made. These are AI interpretations and do not change finishing orders until tested.`
      : "Footage is stored; press Analyse on a clip to read it.",
  });
}

// ---------- Master: suitability, selection, race-day jobs ----------
async function runMaster(sb: SupabaseClient, trigger: string) {
  const runId = await startRun(sb, "master", "Score, select and schedule races", trigger);
  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * 86_400_000);
  const { data: settings } = await sb.from("racing_settings").select("*").eq("id", 1).single();
  const { data: model } = await sb.from("racing_model_versions").select("id,validated_metrics").neq("id", "suitability-v1");
  const modelValidated = (model ?? []).some((m) => m.validated_metrics && Object.keys(m.validated_metrics).length > 0);
  const { data: races } = await sb.from("racing_races")
    .select("id,start_time_utc,has_paddock_video,has_training_video,meeting:racing_meetings(track_rating,racecourse_id)")
    .gte("start_time_utc", now.toISOString()).lte("start_time_utc", horizon.toISOString()).eq("status", "scheduled");

  const scored: Array<{ id: string; score: number }> = [];
  for (const r of races ?? []) {
    const { data: runners } = await sb.from("racing_runners").select("id,horse_id,jockey_id").eq("race_id", r.id).eq("scratched", false);
    const list = runners ?? [];
    let withForm = 0;
    for (const ru of list) {
      const { count } = await sb.from("racing_performances").select("id", { count: "exact", head: true }).eq("horse_id", ru.horse_id).eq("verified", true);
      if ((count ?? 0) >= 3) withForm++;
    }
    const meeting = (r as any).meeting;
    const { data: wx } = await sb.from("racing_weather_observations").select("created_at").eq("racecourse_id", meeting?.racecourse_id)
      .gte("created_at", new Date(now.getTime() - 3 * 3_600_000).toISOString()).limit(1);
    const s = suitabilityScore({
      runners: list.length, runnersWithForm: withForm, runnersWithJockey: list.filter((x) => x.jockey_id).length,
      hasOfficialTrackRating: !!meeting?.track_rating, hasRecentWeather: (wx ?? []).length > 0,
      hasPaddockVideo: r.has_paddock_video, hasTrainingVideo: r.has_training_video, modelValidated,
    });
    await sb.from("racing_races").update({ suitability_score: s.score, data_completeness: s.completeness, suitability_reasons: s.reasons, runners_count: list.length, updated_at: now.toISOString() }).eq("id", r.id);
    scored.push({ id: r.id, score: s.score });
  }
  const chosen = new Set(selectRaces(scored, (settings?.selection_mode ?? "top10") as SelectionMode, settings?.custom_count ?? 10));
  for (const r of races ?? []) {
    await sb.from("racing_races").update({ selected: chosen.has(r.id) }).eq("id", r.id);
    if (!chosen.has(r.id)) continue;
    const jobs = raceDayJobs(new Date(r.start_time_utc), now).map((j) => ({ race_id: r.id, kind: j.kind, due_at: j.due.toISOString() }));
    await sb.from("racing_jobs").upsert(jobs, { onConflict: "race_id,kind", ignoreDuplicates: true });
  }

  // Process due jobs (bounded).
  const { data: due } = await sb.from("racing_jobs").select("id,race_id,kind,attempts").eq("status", "pending").lte("due_at", now.toISOString()).order("due_at").limit(25);
  let processed = 0;
  for (const job of due ?? []) {
    processed++;
    try {
      if (job.kind === "t5") {
        const { data: race } = await sb.from("racing_races").select("start_time_utc").eq("id", job.race_id).single();
        await sb.from("racing_predictions").insert({
          race_id: job.race_id, model_version: "ensemble-untrained", stage: "final", status: "insufficient_data",
          evidence_cutoff: new Date(Math.min(now.getTime(), new Date(race!.start_time_utc).getTime())).toISOString(),
          explanation: "No tested prediction model yet, so no finishing order was published.",
          limitations: "Oracle only publishes finishing orders once a model has been tested on past races without future information.",
        });
      }
      if (job.kind === "post") {
        const { data: result } = await sb.from("racing_results").select("official_order").eq("race_id", job.race_id).maybeSingle();
        const { data: pred } = await sb.from("racing_predictions").select("id,scenario").eq("race_id", job.race_id).eq("status", "locked").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (result && pred) {
          const { data: ranks } = await sb.from("racing_prediction_rankings").select("runner_id,predicted_rank").eq("prediction_id", pred.id).order("predicted_rank");
          const s = scorePrediction((ranks ?? []).map((x) => x.runner_id), (result.official_order as string[]) ?? []);
          await sb.from("racing_accuracy").upsert({ prediction_id: pred.id, race_id: job.race_id, scenario: pred.scenario, winner_hit: s.winnerHit, top2_hit: s.top2Hit, top3_hit: s.top3Hit, exacta_hit: s.exactaHit, rank_correlation: s.rankCorrelation }, { onConflict: "prediction_id" });
        } else if (!result && job.attempts < 12) {
          await sb.from("racing_jobs").update({ attempts: job.attempts + 1, due_at: new Date(now.getTime() + 15 * 60_000).toISOString(), last_error: "Official result not available yet." }).eq("id", job.id);
          continue;
        }
      }
      await sb.from("racing_jobs").update({ status: "done", finished_at: now.toISOString(), attempts: job.attempts + 1 }).eq("id", job.id);
    } catch (e) {
      await sb.from("racing_jobs").update({ status: "failed", attempts: job.attempts + 1, last_error: (e as Error).message.slice(0, 300) }).eq("id", job.id);
    }
  }
  await finishRun(sb, runId, (races ?? []).length ? "succeeded" : "waiting_for_data", {
    races_considered: (races ?? []).length, races_selected: chosen.size, jobs_processed: processed, model_validated: modelValidated,
    reason: (races ?? []).length ? undefined : "No upcoming races stored. Connect a racing data provider to discover races.",
  });
}

async function runAll(sb: SupabaseClient, trigger: string, only?: Engine) {
  const want = (e: Engine) => !only || only === e;
  const force = !!only;
  if (want("discovery")) await runDiscovery(sb, trigger);
  if (want("environment")) await runEnvironment(sb, trigger, force);
  if (want("historical")) await runDataEngine(sb, "historical", trigger);
  if (want("dynamics")) await runDataEngine(sb, "dynamics", trigger);
  if (want("paddock_vision")) await runVisionEngine(sb, "paddock_vision", trigger);
  if (want("race_vision")) await runVisionEngine(sb, "race_vision", trigger);
  if (want("training_vision")) await runVisionEngine(sb, "training_vision", trigger);
  if (want("master")) await runMaster(sb, trigger);
  await sb.from("racing_providers").update({ status: Deno.env.get("LOVABLE_API_KEY") ? "ready" : "awaiting_configuration", last_checked_at: new Date().toISOString() }).eq("id", "oracle-vision");
}

/** Single-flight: only one controller pass at a time. */
async function withLock(sb: SupabaseClient, fn: () => Promise<void>): Promise<boolean> {
  const until = new Date(Date.now() + 4 * 60_000).toISOString();
  const nowIso = new Date().toISOString();
  const { data } = await sb.from("racing_settings").update({ controller_lock_until: until })
    .eq("id", 1).or(`controller_lock_until.is.null,controller_lock_until.lt.${nowIso}`).select("id");
  if (!data?.length) return false;
  try { await fn(); } finally { await sb.from("racing_settings").update({ controller_lock_until: null }).eq("id", 1); }
  return true;
}

async function status(sb: SupabaseClient) {
  const providers = await connectedRacingProviders(sb);
  const { data: full } = await sb.from("racing_providers").select("*").order("category");
  const credSet = new Set(providers.filter((p) => p.has_credentials).map((p) => p.id));
  const runs: Record<string, unknown> = {};
  for (const e of ENGINES) {
    const { data } = await sb.from("racing_engine_runs").select("*").eq("engine", e).order("started_at", { ascending: false }).limit(1).maybeSingle();
    runs[e] = data ?? null;
  }
  return { providers: (full ?? []).map((p) => ({ ...p, has_credentials: credSet.has(p.id) })), runs };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  const input = parsed.data;
  const sb = db();

  // Scheduler path: only "tick".
  const scheduler = await hasSchedulerToken(req).catch(() => false);
  let actor = "scheduler";
  if (!scheduler) {
    const auth = await requireOwner(req);
    if (auth.response) return auth.response;
    actor = auth.user.email ?? auth.user.id;
  } else if (input.action !== "tick") {
    return json({ error: "forbidden" }, 403);
  }

  try {
    if (input.action === "status") return json(await status(sb));

    if (input.action === "save_credentials" || input.action === "clear_credentials") {
      const { data: provider } = await sb.from("racing_providers").select("id,credential_fields,adapter_ready").eq("id", input.provider_id).maybeSingle();
      if (!provider) return json({ error: "unknown_provider" }, 404);
      if (input.action === "clear_credentials") {
        await sb.from("racing_provider_credentials").delete().eq("provider_id", provider.id);
        await sb.from("racing_providers").update({ status: "awaiting_configuration", updated_at: new Date().toISOString() }).eq("id", provider.id);
        await sb.from("racing_audit_log").insert({ actor, action: "credentials_cleared", detail: { provider: provider.id } });
        return json({ ok: true });
      }
      const allowed = new Set<string>(provider.credential_fields ?? []);
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(input.values)) if (allowed.has(k) && v.trim()) values[k] = v.trim();
      if (!Object.keys(values).length || Object.keys(values).length < allowed.size) return json({ error: "missing_fields" }, 400);
      await sb.from("racing_provider_credentials").upsert({ provider_id: provider.id, secret_values: values, updated_at: new Date().toISOString() });
      await sb.from("racing_providers").update({
        status: provider.adapter_ready ? "credentials_saved" : "credentials_saved_adapter_pending",
        updated_at: new Date().toISOString(),
      }).eq("id", provider.id);
      await sb.from("racing_audit_log").insert({ actor, action: "credentials_saved", detail: { provider: provider.id, fields: Object.keys(values) } });
      return json({ ok: true });
    }

    if (input.action === "analyse_clip") {
      const r = await analyseClip(sb, actor, input.video_id, input.frames);
      const { status: code, ...rest } = r as any;
      return json(rest, code ?? 200);
    }

    if (input.action === "tick") {
      const { data: settings } = await sb.from("racing_settings").select("automation_enabled").eq("id", 1).single();
      if (!settings?.automation_enabled) return json({ ok: true, paused: true });
      const ran = await withLock(sb, () => runAll(sb, scheduler ? "schedule" : "manual"));
      return json({ ok: true, ran });
    }

    // Manual run from the control room.
    const ran = await withLock(sb, () => runAll(sb, "manual", input.engine));
    if (!ran) return json({ ok: false, busy: true });
    await sb.from("racing_audit_log").insert({ actor, action: "manual_run", detail: { engine: input.engine ?? "all" } });
    return json({ ok: true, ...(await status(sb)) });
  } catch (e) {
    console.error("racing-controller", (e as Error).message);
    return json({ error: "controller_failed", detail: (e as Error).message.slice(0, 300) }, 500);
  }
});
