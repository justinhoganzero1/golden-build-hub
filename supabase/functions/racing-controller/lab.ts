// Oracle Racing — Historical Prediction Laboratory. Builds training races from
// stored results, trains one model per scenario (A statistics, B + paddock,
// C + training footage, D everything), tests it on the newest unseen races and
// saves every back-test prediction permanently.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { FEATURE_NAMES, classLevel, trackGroup, type Scenario } from "../_shared/racingFeatures.ts";
import { trainAndTest, placeProbabilities, type TrainingRace } from "../_shared/racingModel.ts";
import { scorePrediction } from "../_shared/racingLogic.ts";
import { fetchAll, chunk, audit } from "./common.ts";
import { analyseRunners, buildIndex, featureMatrix, toPerf, type Obs, type RaceRow, type RunnerRow, RACE_SELECT, RUNNER_SELECT } from "./analysis.ts";

const classGroup = (c?: string | null) => { const l = classLevel(c); return l == null ? "Other" : l >= 7 ? "Group & Listed" : l >= 2 ? "Benchmark / Class" : "Maiden"; };
const MAX_SAVED_BACKTESTS = 300;

export async function trainModels(sb: SupabaseClient, actor: string) {
  const results = await fetchAll<any>((a, b) => sb.from("racing_results").select("race_id,official_order").range(a, b), 20_000);
  const withOrder = results.filter((r) => Array.isArray(r.official_order) && r.official_order.length >= 2);
  if (withOrder.length < 20) return { ok: false, reason: `Only ${withOrder.length} past race(s) with results are stored. Import or connect at least a few hundred to train and test a model.`, races: withOrder.length };
  const raceIds = withOrder.map((r) => r.race_id);
  const races: any[] = [];
  for (const c of chunk(raceIds, 200)) { const { data } = await sb.from("racing_races").select(RACE_SELECT).in("id", c); races.push(...(data ?? [])); }
  const runners: any[] = [];
  for (const c of chunk(raceIds, 100)) runners.push(...await fetchAll((a, b) => sb.from("racing_runners").select("race_id," + RUNNER_SELECT).in("race_id", c).range(a, b), 100_000));
  const perfs = await fetchAll<any>((a, b) => sb.from("racing_performances").select("horse_id,race_date,racecourse_id,distance_m,surface,track_rating,race_class,finish_position,field_size,margin_lengths,race_time_s,weight_kg,barrier,jockey_id,trainer_id,sectionals").range(a, b), 300_000);
  const horses = await fetchAll<any>((a, b) => sb.from("racing_horses").select("id,sire").range(a, b), 200_000);
  const obsRows = await fetchAll<any>((a, b) => sb.from("racing_visual_observations").select("horse_id,race_id,available,objective_measures,video:racing_video_sources(kind,recorded_at)").range(a, b), 50_000);
  const obs: Obs[] = obsRows.map((o) => ({ horse_id: o.horse_id, race_id: o.race_id, kind: o.video?.kind ?? "paddock", recorded_at: o.video?.recorded_at ?? null, measures: o.objective_measures ?? {}, available: o.available }));
  const idx = buildIndex(perfs.map(toPerf), horses, obs);
  const runnersByRace = new Map<string, RunnerRow[]>();
  for (const r of runners) { const a = runnersByRace.get(r.race_id); if (a) a.push(r); else runnersByRace.set(r.race_id, [r]); }
  const orderByRace = new Map(withOrder.map((r) => [r.race_id, r.official_order as string[]]));

  // One analysed race → training rows for every scenario.
  const prepared: Array<{ race: RaceRow; list: ReturnType<typeof analyseRunners>["list"]; winner: number; order: number[]; hasP: boolean; hasT: boolean }> = [];
  for (const race of races as RaceRow[]) {
    const rs = runnersByRace.get(race.id) ?? [];
    const { list } = analyseRunners(race, rs, idx, trackGroup(race.meeting?.track_rating)); // stored rating only — never today's weather for a past race
    if (list.length < 2) continue;
    const pos = new Map(list.map((a, i) => [a.runner.id, i]));
    const order = (orderByRace.get(race.id) ?? []).map((id) => pos.get(id)).filter((x): x is number => x != null);
    if (!order.length) continue;
    prepared.push({ race, list, winner: order[0], order, hasP: list.some((a) => a.paddock.score != null), hasT: list.some((a) => a.training.score != null) });
  }

  const summary: Record<string, any> = {};
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  for (const scenario of ["A", "B", "C", "D"] as Scenario[]) {
    const pool = prepared.filter((p) => scenario === "A" || (scenario === "B" ? p.hasP : scenario === "C" ? p.hasT : p.hasP && p.hasT));
    if (pool.length < 20) { summary[scenario] = { trained: false, races: pool.length, reason: scenario === "A" ? "Not enough past races." : "Not enough past races with this kind of footage yet." }; continue; }
    const data: TrainingRace[] = pool.map((p) => ({
      id: p.race.id, date: p.race.start_time_utc, x: featureMatrix(p.list, scenario), winner: p.winner, order: p.order,
      market: p.list.map((a) => a.inputs.marketProb ?? null), country: p.race.meeting?.racecourse?.country_code ?? null, raceClass: classGroup(p.race.race_class),
      hasPaddock: p.hasP, hasTraining: p.hasT,
    }));
    const res = trainAndTest(data);
    if (!res) { summary[scenario] = { trained: false, races: pool.length, reason: "Not enough usable races." }; continue; }
    const id = `oracle-logit-${scenario}-${stamp}`;
    const metrics = { test: res.test, uniform: res.uniform, market: res.market, marketCoverage: res.marketCoverage, calibration: res.calibration, byCountry: res.byCountry, byClass: res.byClass, split: res.split, validation: res.validation };
    const { error } = await sb.from("racing_model_versions").insert({
      id, scenario, status: res.validation.ok ? "validated" : "rejected", trained_at: new Date().toISOString(),
      description: `Scenario ${scenario}: ${({ A: "statistics only", B: "statistics + paddock vision", C: "statistics + training footage", D: "all seven engines" })[scenario]}. ${res.validation.reason}`,
      method: "Conditional logistic regression (L2), temperature-calibrated, time-ordered train/calibrate/test split",
      parameters: { weights: res.weights, temperature: res.temperature, features: FEATURE_NAMES },
      test_metrics: metrics,
      validated_metrics: res.validation.ok ? { winner: res.test.winner, top3: res.test.top3, logLoss: res.test.logLoss, races: res.test.races } : {},
    });
    if (error) throw new Error(error.message);

    // Save back-test predictions for the newest unseen races (permanent, locked).
    const save = res.testPredictions.slice(-MAX_SAVED_BACKTESTS);
    const byId = new Map(pool.map((p) => [p.race.id, p]));
    for (const c of chunk(save, 50)) {
      const { data: preds, error: pe } = await sb.from("racing_predictions").insert(c.map((t) => ({
        race_id: t.raceId, model_version: id, stage: "backtest", scenario, status: "draft", evidence_cutoff: byId.get(t.raceId)!.race.start_time_utc,
        explanation: `Back-test by ${id} using only evidence dated before the race.`, limitations: "Historical test on a race the model never trained on.",
      }))).select("id,race_id");
      if (pe) throw new Error(pe.message);
      const rankings: any[] = [], accuracy: any[] = [];
      for (const pr of preds ?? []) {
        const t = c.find((x) => x.raceId === pr.race_id)!; const p = byId.get(pr.race_id)!;
        const places = placeProbabilities(t.probs, 2000);
        const order = t.probs.map((q, i) => ({ q, i })).sort((a, b) => b.q - a.q);
        order.forEach((o, rank) => rankings.push({ prediction_id: pr.id, runner_id: p.list[o.i].runner.id, predicted_rank: rank + 1, p_win: +o.q.toFixed(4), p_top2: +places[o.i].top2.toFixed(4), p_top3: +places[o.i].top3.toFixed(4), p_top4: +places[o.i].top4.toFixed(4) }));
        const s = scorePrediction(order.map((o) => p.list[o.i].runner.id), p.order.map((i) => p.list[i].runner.id));
        accuracy.push({ prediction_id: pr.id, race_id: pr.race_id, scenario, winner_hit: s.winnerHit, top2_hit: s.top2Hit, top3_hit: s.top3Hit, exacta_hit: s.exactaHit, rank_correlation: s.rankCorrelation,
          brier_score: +t.probs.reduce((a, q, i) => a + (q - (i === p.winner ? 1 : 0)) ** 2, 0).toFixed(4), log_loss: +(-Math.log(Math.max(1e-9, t.probs[p.winner]))).toFixed(4) });
      }
      for (const rc of chunk(rankings, 500)) await sb.from("racing_prediction_rankings").insert(rc);
      await sb.from("racing_predictions").update({ status: "locked", locked_at: new Date().toISOString() }).in("id", (preds ?? []).map((x) => x.id));
      await sb.from("racing_accuracy").insert(accuracy);
    }
    summary[scenario] = { trained: true, id, races: pool.length, validated: res.validation.ok, reason: res.validation.reason, test: res.test, market: res.market, uniform: res.uniform };
  }
  await audit(sb, actor, "models_trained", { races: prepared.length, scenarios: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { trained: v.trained, validated: v.validated ?? false }])) });
  return { ok: true, races: prepared.length, scenarios: summary };
}
