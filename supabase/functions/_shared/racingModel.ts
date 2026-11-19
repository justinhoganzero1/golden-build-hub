// Oracle Racing — Master prediction maths. Pure functions (no Deno/browser
// imports) so tests and screens use the same code as the controller.
//
// Model: conditional logistic regression (each race is one "choose the winner"
// problem; a runner's chance = softmax of its weighted features within the race),
// trained by gradient descent with L2 shrinkage, then calibrated with a single
// temperature fitted on races the model did not train on. Top-2/3/4 chances come
// from simulating the finishing order (Plackett–Luce) with a fixed seed.

import { scorePrediction } from "./racingLogic.ts";

export interface TrainingRace { id: string; date: string; x: number[][]; winner: number; order?: number[]; market?: Array<number | null>; country?: string | null; raceClass?: string | null; hasPaddock?: boolean; hasTraining?: boolean }

export function softmax(scores: number[], temperature = 1): number[] {
  const t = temperature > 0 ? temperature : 1;
  const m = Math.max(...scores.map((s) => s / t));
  const e = scores.map((s) => Math.exp(s / t - m));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / z);
}
const dot = (w: number[], x: number[]) => x.reduce((s, v, i) => s + v * (w[i] ?? 0), 0);

export function predictRace(weights: number[], x: number[][], temperature = 1): number[] {
  return softmax(x.map((row) => dot(weights, row)), temperature);
}

export function trainConditionalLogit(races: TrainingRace[], opts: { l2?: number; iters?: number; lr?: number } = {}): number[] {
  const k = races[0]?.x[0]?.length ?? 0;
  const w = new Array(k).fill(0);
  if (!k || !races.length) return w;
  const l2 = opts.l2 ?? 0.01, iters = opts.iters ?? 400, lr = opts.lr ?? 0.5;
  // Adam keeps training stable whatever the feature scales.
  const m = new Array(k).fill(0), v = new Array(k).fill(0);
  for (let t = 1; t <= iters; t++) {
    const g = new Array(k).fill(0);
    for (const r of races) {
      const p = predictRace(w, r.x);
      r.x.forEach((row, i) => { const d = p[i] - (i === r.winner ? 1 : 0); for (let j = 0; j < k; j++) g[j] += d * row[j]; });
    }
    for (let j = 0; j < k; j++) {
      const gj = g[j] / races.length + l2 * w[j];
      m[j] = 0.9 * m[j] + 0.1 * gj;
      v[j] = 0.999 * v[j] + 0.001 * gj * gj;
      const mh = m[j] / (1 - 0.9 ** t), vh = v[j] / (1 - 0.999 ** t);
      w[j] -= (lr * 0.1) * mh / (Math.sqrt(vh) + 1e-8);
    }
  }
  return w;
}

export function logLoss(probs: number[][], winners: number[]): number {
  if (!probs.length) return NaN;
  return probs.reduce((s, p, i) => s - Math.log(Math.max(1e-9, p[winners[i]] ?? 1e-9)), 0) / probs.length;
}
export function brier(probs: number[][], winners: number[]): number {
  if (!probs.length) return NaN;
  return probs.reduce((s, p, i) => s + p.reduce((a, q, j) => a + (q - (j === winners[i] ? 1 : 0)) ** 2, 0), 0) / probs.length;
}

/** Pick the temperature (0.5–3) that gives the most honest probabilities on held-out races. */
export function fitTemperature(weights: number[], races: TrainingRace[]): number {
  if (!races.length) return 1;
  let best = 1, bestLoss = Infinity;
  for (let t = 0.5; t <= 3.0001; t += 0.05) {
    const ll = logLoss(races.map((r) => predictRace(weights, r.x, t)), races.map((r) => r.winner));
    if (ll < bestLoss) { bestLoss = ll; best = Number(t.toFixed(2)); }
  }
  return best;
}

/** Small, fast, repeatable random numbers so simulations give the same answer every time. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Chance of finishing in the top 1..4 for each runner, simulated from win chances. */
export function placeProbabilities(pWin: number[], sims = 4000, seed = 7): Array<{ top1: number; top2: number; top3: number; top4: number }> {
  const n = pWin.length;
  const counts = pWin.map(() => [0, 0, 0, 0]);
  const rnd = seededRandom(seed);
  for (let s = 0; s < sims; s++) {
    const left = pWin.map((p, i) => ({ i, p: Math.max(p, 1e-9) }));
    for (let pos = 0; pos < Math.min(4, n); pos++) {
      const total = left.reduce((a, b) => a + b.p, 0);
      let r = rnd() * total, k = 0;
      while (k < left.length - 1 && r > left[k].p) { r -= left[k].p; k++; }
      const pick = left.splice(k, 1)[0];
      for (let q = pos; q < 4; q++) counts[pick.i][q]++;
    }
  }
  return counts.map((c) => ({ top1: c[0] / sims, top2: c[1] / sims, top3: c[2] / sims, top4: c[3] / sims }));
}

export interface EvalSummary { races: number; logLoss: number | null; brier: number | null; winner: number | null; top2: number | null; top3: number | null; exacta: number | null; rankCorrelation: number | null }

export function evaluate(probs: number[][], races: TrainingRace[]): EvalSummary {
  if (!races.length) return { races: 0, logLoss: null, brier: null, winner: null, top2: null, top3: null, exacta: null, rankCorrelation: null };
  let w = 0, t2 = 0, t3 = 0, ex = 0, rc = 0, rcn = 0;
  races.forEach((r, i) => {
    const predicted = probs[i].map((p, j) => ({ p, j })).sort((a, b) => b.p - a.p).map((x) => String(x.j));
    const actual = (r.order ?? [r.winner]).map(String);
    const s = scorePrediction(predicted, actual);
    if (s.winnerHit) w++;
    if (s.top2Hit) t2++;
    if (s.top3Hit) t3++;
    if (s.exactaHit) ex++;
    if (s.rankCorrelation != null) { rc += s.rankCorrelation; rcn++; }
  });
  const n = races.length;
  const winners = races.map((r) => r.winner);
  return { races: n, logLoss: logLoss(probs, winners), brier: brier(probs, winners), winner: w / n, top2: t2 / n, top3: t3 / n, exacta: ex / n, rankCorrelation: rcn ? rc / rcn : null };
}

/** Predicted-chance buckets vs how often those runners really won. */
export function calibrationBins(probs: number[][], races: TrainingRace[], bins = 10) {
  const b = Array.from({ length: bins }, (_, i) => ({ from: i / bins, to: (i + 1) / bins, n: 0, predicted: 0, won: 0 }));
  races.forEach((r, i) => probs[i].forEach((p, j) => {
    const k = Math.min(bins - 1, Math.floor(p * bins));
    b[k].n++; b[k].predicted += p; if (j === r.winner) b[k].won++;
  }));
  return b.filter((x) => x.n > 0).map((x) => ({ from: x.from, to: x.to, runners: x.n, predicted: x.predicted / x.n, actual: x.won / x.n }));
}

export const MIN_TEST_RACES = 100;
export const MIN_MARKET_COVERAGE = 0.8;

/**
 * A model may make live predictions only when it was tested on enough races it
 * never saw and beat the honest alternatives: the betting market (when prices
 * exist for most test races) and "every runner equal".
 */
export function passesValidation(model: EvalSummary, uniform: EvalSummary, market: EvalSummary | null, marketCoverage: number): { ok: boolean; reason: string } {
  if (model.races < MIN_TEST_RACES) return { ok: false, reason: `Only ${model.races} unseen test races; at least ${MIN_TEST_RACES} are needed.` };
  if (model.logLoss == null || uniform.logLoss == null || model.logLoss >= uniform.logLoss * 0.98) return { ok: false, reason: "It did not beat simply treating every runner as equal." };
  if (marketCoverage >= MIN_MARKET_COVERAGE && market?.logLoss != null && model.logLoss >= market.logLoss) return { ok: false, reason: "It did not beat the betting market on the same races." };
  return { ok: true, reason: marketCoverage >= MIN_MARKET_COVERAGE ? "Beat the betting market and equal chances on unseen races." : "Beat equal chances on unseen races (too few prices to compare with the market)." };
}

export interface TrainResult {
  weights: number[]; temperature: number;
  split: { train: number; calibrate: number; test: number; from: string | null; to: string | null };
  test: EvalSummary; uniform: EvalSummary; market: EvalSummary | null; marketCoverage: number;
  calibration: ReturnType<typeof calibrationBins>;
  byCountry: Record<string, EvalSummary>; byClass: Record<string, EvalSummary>;
  validation: { ok: boolean; reason: string };
  testPredictions: Array<{ raceId: string; probs: number[] }>;
}

const groupEval = (races: TrainingRace[], probs: number[][], key: (r: TrainingRace) => string) => {
  const g: Record<string, { r: TrainingRace[]; p: number[][] }> = {};
  races.forEach((r, i) => { const k = key(r); (g[k] ??= { r: [], p: [] }).r.push(r); g[k].p.push(probs[i]); });
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, evaluate(v.p, v.r)]));
};

/** Time-ordered split: learn on the oldest 60%, calibrate on the next 15%, test on the newest 25%. */
export function trainAndTest(races: TrainingRace[]): TrainResult | null {
  const sorted = [...races].filter((r) => r.x.length >= 2 && r.winner >= 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  if (sorted.length < 20) return null;
  const a = Math.floor(sorted.length * 0.6), b = Math.floor(sorted.length * 0.75);
  const train = sorted.slice(0, a), cal = sorted.slice(a, b), test = sorted.slice(b);
  const weights = trainConditionalLogit(train);
  const temperature = fitTemperature(weights, cal);
  const probs = test.map((r) => predictRace(weights, r.x, temperature));
  const uniformProbs = test.map((r) => r.x.map(() => 1 / r.x.length));
  const withMarket = test.filter((r) => r.market && r.market.filter((m) => m != null).length >= r.x.length * 0.8);
  const marketCoverage = test.length ? withMarket.length / test.length : 0;
  const marketProbs = withMarket.map((r) => { const m = r.market!.map((x) => x ?? 0.001); const s = m.reduce((p, q) => p + q, 0); return m.map((x) => x / s); });
  const testEval = evaluate(probs, test);
  const uniform = evaluate(uniformProbs, test);
  const market = withMarket.length ? evaluate(marketProbs, withMarket) : null;
  // Compare with the market on exactly the same races when prices exist.
  const modelOnMarketRaces = withMarket.length ? evaluate(withMarket.map((r) => predictRace(weights, r.x, temperature)), withMarket) : null;
  const validation = passesValidation(modelOnMarketRaces && marketCoverage >= MIN_MARKET_COVERAGE ? { ...testEval, logLoss: modelOnMarketRaces.logLoss } : testEval, uniform, market, marketCoverage);
  return {
    weights, temperature,
    split: { train: train.length, calibrate: cal.length, test: test.length, from: sorted[0]?.date ?? null, to: sorted[sorted.length - 1]?.date ?? null },
    test: testEval, uniform, market, marketCoverage,
    calibration: calibrationBins(probs, test),
    byCountry: groupEval(test, probs, (r) => r.country || "Unknown"),
    byClass: groupEval(test, probs, (r) => r.raceClass || "Unknown"),
    validation,
    testPredictions: test.map((r, i) => ({ raceId: r.id, probs: probs[i] })),
  };
}

/**
 * Analytical confidence (0–100): how much good evidence stands behind this
 * prediction — NOT the chance of any horse winning.
 */
export function analyticalConfidence(dataQualities: number[], modelSkill: number): number {
  if (!dataQualities.length) return 0;
  const evidence = dataQualities.reduce((s, x) => s + x, 0) / dataQualities.length;
  return Math.round(100 * Math.max(0, Math.min(1, evidence)) * Math.max(0, Math.min(1, modelSkill)));
}
