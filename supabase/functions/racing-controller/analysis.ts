// Oracle Racing — per-race analysis: engines 2, 4, 5 and the vision engines
// write their own assessments, the master combines them with a tested model.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  horseForm, peopleStats, runStyle, paceMap, trackGroup, forecastTrackGroup, visionScores, rawFeatures,
  normaliseWithinRace, marketProbabilities, type Perf, type RaceContext, type RunnerInputs, type Scenario, type TrackGroup, type HorseForm,
} from "../_shared/racingFeatures.ts";
import { predictRace, placeProbabilities, analyticalConfidence } from "../_shared/racingModel.ts";
import { usableBeforeRace } from "../_shared/racingLogic.ts";
import { fetchAll, chunk } from "./common.ts";

const PERF_COLS = "horse_id,race_date,racecourse_id,distance_m,surface,track_rating,race_class,finish_position,field_size,margin_lengths,race_time_s,weight_kg,barrier,jockey_id,trainer_id,sectionals,verified";
export const toPerf = (p: any): Perf => ({ ...p, settled: p?.sectionals?.settled ?? null });

export interface Obs { horse_id: string | null; race_id: string | null; kind: string; recorded_at: string | null; measures: any; available: boolean }

/** In-memory evidence indexes, built either for one race (live) or for the whole history (laboratory). */
export interface EvidenceIndex {
  byHorse: Map<string, Perf[]>; byJockey: Map<string, Perf[]>; byTrainer: Map<string, Perf[]>;
  sireOf: Map<string, string>; horsesBySire: Map<string, string[]>; obsByHorse: Map<string, Obs[]>;
}
const push = <K, V>(m: Map<K, V[]>, k: K | null | undefined, v: V) => { if (k == null) return; const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };

export function buildIndex(perfs: Perf[], horses: Array<{ id: string; sire: string | null }>, obs: Obs[]): EvidenceIndex {
  const idx: EvidenceIndex = { byHorse: new Map(), byJockey: new Map(), byTrainer: new Map(), sireOf: new Map(), horsesBySire: new Map(), obsByHorse: new Map() };
  for (const p of perfs) { push(idx.byHorse, p.horse_id, p); push(idx.byJockey, p.jockey_id, p); push(idx.byTrainer, p.trainer_id, p); }
  for (const h of horses) if (h.sire) { const s = h.sire.trim().toLowerCase(); idx.sireOf.set(h.id, s); push(idx.horsesBySire, s, h.id); }
  for (const o of obs) push(idx.obsByHorse, o.horse_id, o);
  return idx;
}

export interface RunnerRow { id: string; horse_id: string; jockey_id: string | null; trainer_id: string | null; saddlecloth: number | null; barrier: number | null; weight_kg: number | null; scratched: boolean; odds: any; horse?: { name?: string } }
export interface RaceRow { id: string; start_time_utc: string; distance_m: number | null; surface: string | null; race_class: string | null; meeting: { racecourse_id: string; track_rating: string | null; racecourse?: { country_code?: string | null; name?: string } } }

export const priceOf = (odds: any): number | null => {
  const v = Number(odds?.pre_race_win ?? odds?.win ?? odds?.price);
  return Number.isFinite(v) && v > 1 ? v : null;
};

export interface RunnerAnalysis {
  runner: RunnerRow; inputs: RunnerInputs; form: HorseForm; style: string;
  paddock: { score: number | null; notes: string[] }; training: { score: number | null; sessions: number; trend: number | null };
}

function obsScore(list: Obs[]): number | null {
  const vals: number[] = [];
  for (const o of list) { const s = visionScores(o.measures); for (const v of [s.calm, s.sweat, s.walk]) if (v != null) vals.push(v); }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Everything the engines know about each runner, using only evidence from before the start. */
export function analyseRunners(race: RaceRow, runners: RunnerRow[], idx: EvidenceIndex, track: TrackGroup): { list: RunnerAnalysis[]; pace: ReturnType<typeof paceMap> } {
  const start = new Date(race.start_time_utc);
  const date = race.start_time_utc.slice(0, 10);
  const active = runners.filter((r) => !r.scratched);
  const market = marketProbabilities(active.map((r) => priceOf(r.odds)));
  const styles = active.map((r) => runStyle(idx.byHorse.get(r.horse_id) ?? [], date));
  const pace = paceMap(styles);
  const list = active.map((r, i): RunnerAnalysis => {
    const ctx: RaceContext = { date, racecourse_id: race.meeting?.racecourse_id, distance_m: race.distance_m, surface: race.surface, track, race_class: race.race_class, weight_kg: r.weight_kg, barrier: r.barrier };
    const own = idx.byHorse.get(r.horse_id) ?? [];
    const form = horseForm(own, ctx);
    const jockey = r.jockey_id ? peopleStats(idx.byJockey.get(r.jockey_id) ?? [], ctx) : null;
    const trainer = r.trainer_id ? peopleStats(idx.byTrainer.get(r.trainer_id) ?? [], ctx) : null;
    const combo = r.jockey_id ? peopleStats(own.filter((p) => p.jockey_id === r.jockey_id), ctx) : null;
    const sire = idx.sireOf.get(r.horse_id);
    const siblings = sire ? (idx.horsesBySire.get(sire) ?? []).filter((h) => h !== r.horse_id).flatMap((h) => idx.byHorse.get(h) ?? []) : [];
    const sireDistance = siblings.length ? horseForm(siblings, ctx).distance : null;
    const style = styles[i];
    const paceFit = pace.pace === "unknown" || style === "unknown" ? null
      : pace.favours.includes(style) ? 1
      : (pace.pace === "hot" && style === "leader") || (pace.pace === "soft" && style === "backmarker") ? -1 : 0;
    // Vision: footage filmed before the start only; race replays are never pre-race evidence.
    const obs = (idx.obsByHorse.get(r.horse_id) ?? []).filter((o) => o.available && o.kind !== "race" && o.recorded_at && usableBeforeRace(new Date(o.recorded_at), start));
    const paddockObs = obs.filter((o) => o.kind === "paddock" && (o.race_id === race.id || start.getTime() - Date.parse(o.recorded_at!) < 36 * 3600_000));
    const trainingObs = obs.filter((o) => ["training", "trial", "warmup", "owner_upload"].includes(o.kind) && start.getTime() - Date.parse(o.recorded_at!) < 90 * 86_400_000)
      .sort((a, b) => (a.recorded_at! < b.recorded_at! ? -1 : 1));
    const tScores = trainingObs.map((o) => obsScore([o])).filter((x): x is number => x != null);
    const paddock = { score: obsScore(paddockObs), notes: paddockObs.map((o) => String(o.measures?.note ?? "")).filter(Boolean).slice(0, 3) };
    const training = { score: obsScore(trainingObs), sessions: trainingObs.length, trend: tScores.length >= 2 ? tScores[tScores.length - 1] - tScores[0] : null };
    return {
      runner: r, form, style, paddock, training,
      inputs: { form, jockey, trainer, combo, sireDistance, paceFit, barrier: r.barrier, marketProb: market[i], paddock: paddock.score, training: training.score },
    };
  });
  return { list, pace };
}

export function featureMatrix(list: RunnerAnalysis[], scenario: Scenario): number[][] {
  return normaliseWithinRace(list.map((a) => rawFeatures(a.inputs, scenario)));
}

/** Pick the condition used for this race: official rating first, else a rain-based estimate (clearly labelled). */
export async function raceTrack(sb: SupabaseClient, race: RaceRow, live: boolean): Promise<{ track: TrackGroup; source: string; weather: any }> {
  const official = trackGroup(race.meeting?.track_rating);
  let weather: any = null;
  if (live && race.meeting?.racecourse_id) {
    const { data } = await sb.from("racing_weather_observations").select("temperature_c,humidity_pct,wind_kph,wind_direction_deg,rain_mm,observed_for")
      .eq("racecourse_id", race.meeting.racecourse_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    weather = data;
  }
  if (official !== "unknown") return { track: official, source: `Official rating: ${race.meeting.track_rating}`, weather };
  if (weather) { const g = forecastTrackGroup(Number(weather.rain_mm)); if (g !== "unknown") return { track: g, source: `Estimate from ${weather.rain_mm} mm forecast-model rain (not an official rating)`, weather }; }
  return { track: "unknown", source: "No track rating or weather available", weather };
}

/** Load the evidence for one upcoming race. */
export async function loadRaceIndex(sb: SupabaseClient, runners: RunnerRow[]): Promise<EvidenceIndex> {
  const horseIds = [...new Set(runners.map((r) => r.horse_id))];
  const jockeys = [...new Set(runners.map((r) => r.jockey_id).filter(Boolean))] as string[];
  const trainers = [...new Set(runners.map((r) => r.trainer_id).filter(Boolean))] as string[];
  const { data: horses } = await sb.from("racing_horses").select("id,sire").in("id", horseIds);
  const sires = [...new Set((horses ?? []).map((h) => h.sire).filter(Boolean))] as string[];
  const siblings = sires.length ? await fetchAll<any>((a, b) => sb.from("racing_horses").select("id,sire").in("sire", sires).range(a, b), 20_000) : [];
  const allHorses = [...(horses ?? []), ...siblings];
  const horseSet = [...new Set(allHorses.map((h) => h.id))];
  const perfs: any[] = [];
  for (const c of chunk(horseSet, 150)) perfs.push(...await fetchAll((a, b) => sb.from("racing_performances").select(PERF_COLS).in("horse_id", c).range(a, b), 50_000));
  for (const c of chunk(jockeys, 50)) perfs.push(...await fetchAll((a, b) => sb.from("racing_performances").select(PERF_COLS).in("jockey_id", c).range(a, b), 50_000));
  for (const c of chunk(trainers, 50)) perfs.push(...await fetchAll((a, b) => sb.from("racing_performances").select(PERF_COLS).in("trainer_id", c).range(a, b), 50_000));
  const seen = new Set<string>();
  const unique = perfs.filter((p) => { const k = `${p.horse_id}|${p.race_date}|${p.racecourse_id}|${p.finish_position}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const obsRows = await fetchAll<any>((a, b) => sb.from("racing_visual_observations").select("horse_id,race_id,available,objective_measures,ai_interpretation,video:racing_video_sources(kind,recorded_at)").in("horse_id", horseIds).range(a, b), 5_000);
  const obs: Obs[] = obsRows.map((o) => ({ horse_id: o.horse_id, race_id: o.race_id, kind: o.video?.kind ?? "paddock", recorded_at: o.video?.recorded_at ?? null, measures: { ...(o.objective_measures ?? {}), note: o.ai_interpretation }, available: o.available }));
  return buildIndex(unique.map(toPerf), allHorses, obs);
}

export const RACE_SELECT = "id,start_time_utc,distance_m,surface,race_class,has_paddock_video,has_training_video,meeting:racing_meetings(racecourse_id,track_rating,racecourse:racing_racecourses(name,country_code))";
export const RUNNER_SELECT = "id,horse_id,jockey_id,trainer_id,saddlecloth,barrier,weight_kg,scratched,odds,horse:racing_horses(name)";

export async function latestValidatedModels(sb: SupabaseClient) {
  const { data } = await sb.from("racing_model_versions").select("id,scenario,parameters,test_metrics,trained_at").eq("status", "validated").order("trained_at", { ascending: false });
  const best: Partial<Record<Scenario, any>> = {};
  for (const m of data ?? []) if (m.scenario && !best[m.scenario as Scenario]) best[m.scenario as Scenario] = m;
  return best;
}

export function modelSkill(model: any): number {
  const t = model?.test_metrics;
  const m = Number(t?.test?.logLoss), u = Number(t?.uniform?.logLoss);
  if (!Number.isFinite(m) || !Number.isFinite(u) || u <= 0) return 0;
  return Math.max(0, Math.min(1, ((u - m) / u) * 4));
}

export type Stage = "morning" | "t30" | "t10" | "final" | "manual";

/**
 * Run every engine for one race, store each engine's assessment with its
 * evidence cut-off, flag missing or conflicting data, and — only when a tested
 * model exists — record the master prediction (locked at the final stage).
 */
export async function analyseRace(sb: SupabaseClient, raceId: string, stage: Stage) {
  const now = new Date();
  const { data: race } = await sb.from("racing_races").select(RACE_SELECT).eq("id", raceId).maybeSingle();
  if (!race) return { error: "unknown_race" };
  const start = new Date((race as any).start_time_utc);
  const cutoff = new Date(Math.min(now.getTime(), start.getTime())).toISOString();
  const { data: runnerRows } = await sb.from("racing_runners").select(RUNNER_SELECT).eq("race_id", raceId).order("saddlecloth");
  const runners = (runnerRows ?? []) as unknown as RunnerRow[];
  if (!runners.length) return { error: "no_field", message: "No field stored for this race yet." };
  const idx = await loadRaceIndex(sb, runners);
  // Current weather only describes races about to run; a past race never gets today's forecast.
  const liveWindow = start.getTime() > now.getTime() - 6 * 3600_000 && start.getTime() < now.getTime() + 4 * 86_400_000;
  const { track, source: trackSource, weather } = await raceTrack(sb, race as any, liveWindow);
  const { list, pace } = analyseRunners(race as any, runners, idx, track);

  // Missing and conflicting information.
  const missing: string[] = [], conflicts: string[] = [];
  const noForm = list.filter((a) => a.form.starts === 0).map((a) => a.runner.horse?.name);
  if (noForm.length) missing.push(`No past runs stored for ${noForm.length} runner(s): ${noForm.slice(0, 6).join(", ")}${noForm.length > 6 ? "…" : ""}.`);
  if (list.some((a) => !a.runner.jockey_id)) missing.push("Some jockeys are not confirmed.");
  if (track === "unknown") missing.push("No official track rating or weather for this course.");
  else if (!(race as any).meeting?.track_rating) missing.push("Track condition is an estimate from rain, not an official rating.");
  if (list.every((a) => a.inputs.marketProb == null)) missing.push("No betting prices available.");
  const cloths = list.map((a) => a.runner.saddlecloth).filter((x) => x != null);
  if (new Set(cloths).size !== cloths.length) conflicts.push("Two runners share a saddlecloth number.");
  const field = list.length;
  for (const a of list) if (a.runner.barrier != null && a.runner.barrier > runners.length + 4) conflicts.push(`${a.runner.horse?.name}: barrier ${a.runner.barrier} is wider than the field.`);
  if (weather && (race as any).meeting?.track_rating) {
    const est = forecastTrackGroup(Number(weather.rain_mm));
    if (est !== "unknown" && est !== track && !(est === "good" && track === "firm")) conflicts.push(`Official rating says ${track}, but recent rain suggests ${est}. Official rating used.`);
  }

  const evidenceCutoff = cutoff;
  const rows: any[] = [];
  for (const a of list) {
    const f = a.form;
    rows.push({ race_id: raceId, runner_id: a.runner.id, engine: "historical", data_quality: f.dataQuality, evidence_cutoff: evidenceCutoff, assessment: {
      starts: f.starts, wins: f.wins, places: f.places, winPct: f.winPct, placePct: f.placePct, recentForm: f.recentForm, consistency: f.consistency, trend: f.trend,
      daysSinceLast: f.daysSinceLast, avgMargin: f.avgMargin, speedMs: f.speedMs, classDelta: f.classDelta, weightDiff: f.weightDiff,
      distance: f.distance, course: f.course, surface: f.surface, barrierBand: f.barrierBand, lastStarts: f.lastStarts,
    } });
    rows.push({ race_id: raceId, runner_id: a.runner.id, engine: "environment", data_quality: track === "unknown" ? 0 : Math.min(1, f.condition.starts / 3), evidence_cutoff: evidenceCutoff, assessment: {
      track, trackSource, condition: f.condition, weather,
    } });
    rows.push({ race_id: raceId, runner_id: a.runner.id, engine: "dynamics", data_quality: a.inputs.jockey?.rides ? Math.min(1, a.inputs.jockey.rides / 30) : 0, evidence_cutoff: evidenceCutoff, assessment: {
      jockey: a.inputs.jockey, trainer: a.inputs.trainer, combo: a.inputs.combo, sireDistance: a.inputs.sireDistance, style: a.style, paceFit: a.inputs.paceFit,
    } });
    rows.push({ race_id: raceId, runner_id: a.runner.id, engine: "paddock_vision", data_quality: a.paddock.score == null ? 0 : 1, evidence_cutoff: evidenceCutoff, assessment: { available: a.paddock.score != null, score: a.paddock.score, notes: a.paddock.notes } });
    rows.push({ race_id: raceId, runner_id: a.runner.id, engine: "training_vision", data_quality: a.training.score == null ? 0 : Math.min(1, a.training.sessions / 3), evidence_cutoff: evidenceCutoff, assessment: { available: a.training.score != null, ...a.training } });
  }

  // Master: only a model that passed testing may rank the field.
  const models = await latestValidatedModels(sb);
  const hasP = list.some((a) => a.paddock.score != null), hasT = list.some((a) => a.training.score != null);
  const scenario: Scenario | null = hasP && hasT && models.D ? "D" : hasP && models.B ? "B" : hasT && models.C ? "C" : models.A ? "A" : null;
  const model = scenario ? models[scenario] : null;
  let prediction: any = null;
  if (model && field >= 2) {
    const x = featureMatrix(list, scenario!);
    const pWin = predictRace(model.parameters.weights, x, model.parameters.temperature ?? 1);
    const places = placeProbabilities(pWin);
    const order = pWin.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
    const confidence = analyticalConfidence(list.map((a) => a.form.dataQuality), modelSkill(model));
    const locked = stage === "final";
    const { data: pred, error } = await sb.from("racing_predictions").insert({
      race_id: raceId, model_version: model.id, stage, scenario, status: "draft", analytical_confidence: confidence, evidence_cutoff: evidenceCutoff,
      explanation: `Ranked by ${model.id} (scenario ${scenario}) from ${field} runners using form, conditions, jockey/trainer, breeding, pace${hasP ? ", paddock video" : ""}${hasT ? ", training footage" : ""} and prices where available.`,
      limitations: [...missing, ...conflicts].join(" ") || "No major gaps found.",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await sb.from("racing_prediction_rankings").insert(order.map((o, rank) => ({ prediction_id: pred.id, runner_id: list[o.i].runner.id, predicted_rank: rank + 1, p_win: +o.p.toFixed(4), p_top2: +places[o.i].top2.toFixed(4), p_top3: +places[o.i].top3.toFixed(4), p_top4: +places[o.i].top4.toFixed(4) })));
    if (locked) await sb.from("racing_predictions").update({ status: "locked", locked_at: now.toISOString() }).eq("id", pred.id);
    for (const o of order) rows.push({ race_id: raceId, runner_id: list[o.i].runner.id, engine: "master", model_version: model.id, data_quality: list[o.i].form.dataQuality, evidence_cutoff: evidenceCutoff, assessment: { p_win: o.p, ...places[o.i] } });
    prediction = { id: pred.id, scenario, model: model.id, confidence, locked, top3: order.slice(0, 3).map((o) => list[o.i].runner.horse?.name) };
  } else if (stage === "final") {
    await sb.from("racing_predictions").insert({
      race_id: raceId, model_version: "ensemble-untrained", stage: "final", status: "insufficient_data", evidence_cutoff: evidenceCutoff,
      explanation: "No tested prediction model yet, so no finishing order was published.",
      limitations: "Oracle only publishes finishing orders once a model has beaten the honest alternatives on races it never saw. Engine assessments were still recorded.",
    });
  }
  rows.push({ race_id: raceId, runner_id: null, engine: "master_summary", evidence_cutoff: evidenceCutoff, data_quality: list.reduce((s, a) => s + a.form.dataQuality, 0) / Math.max(1, list.length), assessment: {
    stage, missing, conflicts, pace, track, trackSource, field, scenario, model: model?.id ?? null, predicted: !!prediction,
  } });
  for (const c of chunk(rows, 400)) { const { error } = await sb.from("racing_engine_assessments").insert(c); if (error) throw new Error(error.message); }
  await sb.from("racing_races").update({ has_paddock_video: hasP || undefined, has_training_video: hasT || undefined, updated_at: now.toISOString() }).eq("id", raceId);
  return { ok: true, runners: field, missing, conflicts, pace: pace.pace, track, trackSource, prediction, message: prediction ? undefined : "Engines ran and saved their findings. No finishing order yet — no model has passed testing." };
}
