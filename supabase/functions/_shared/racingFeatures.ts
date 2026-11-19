// Oracle Racing — pure analysis maths for engines 2, 4 and 5 and the model
// features. No Deno or browser imports, so the app screens, the controller
// and tests share exactly the same numbers. Every function only looks at
// evidence dated strictly before the race being analysed (no future leakage).

export interface Perf {
  horse_id?: string;
  race_date: string; // YYYY-MM-DD
  racecourse_id?: string | null;
  distance_m?: number | null;
  surface?: string | null;
  track_rating?: string | null;
  race_class?: string | null;
  finish_position?: number | null;
  field_size?: number | null;
  margin_lengths?: number | null;
  race_time_s?: number | null;
  weight_kg?: number | null;
  barrier?: number | null;
  jockey_id?: string | null;
  trainer_id?: string | null;
  settled?: number | null; // early running position, when the source gives it
}

export type TrackGroup = "firm" | "good" | "soft" | "heavy" | "synthetic" | "unknown";

/** Group track ratings from different countries into comparable conditions. */
export function trackGroup(rating?: string | null): TrackGroup {
  const r = String(rating ?? "").toLowerCase().trim();
  if (!r) return "unknown";
  if (/synthetic|poly|tapeta|all.?weather|standard/.test(r)) return "synthetic";
  if (/heavy|sloppy|muddy|bottomless/.test(r)) return "heavy";
  if (/soft|yielding|good to soft|dead/.test(r)) return "soft";
  if (/firm|fast|hard|good to firm/.test(r)) return "firm";
  const n = r.match(/\d+/);
  if (n) {
    const v = Number(n[0]);
    if (v <= 2) return "firm";
    if (v <= 4) return "good";
    if (v <= 7) return "soft";
    return "heavy";
  }
  if (/good/.test(r)) return "good";
  return "unknown";
}

/** Rough condition estimate from rain only — always labelled an estimate, never a track rating. */
export function forecastTrackGroup(rain24hMm: number | null | undefined): TrackGroup {
  if (rain24hMm == null || !Number.isFinite(rain24hMm)) return "unknown";
  if (rain24hMm < 2) return "good";
  if (rain24hMm < 10) return "soft";
  return "heavy";
}

/** Approximate race quality on one scale (higher = stronger opposition). */
export function classLevel(raceClass?: string | null): number | null {
  const c = String(raceClass ?? "").toLowerCase();
  if (!c) return null;
  if (/group ?1|grade ?1|\bg1\b/.test(c)) return 10;
  if (/group ?2|grade ?2|\bg2\b/.test(c)) return 9;
  if (/group ?3|grade ?3|\bg3\b/.test(c)) return 8;
  if (/listed|\blr\b/.test(c)) return 7;
  const bm = c.match(/(?:bm|benchmark|rating)\s*(\d+)/);
  if (bm) return Math.min(6.5, Math.max(1, Number(bm[1]) / 12));
  const cl = c.match(/class\s*(\d)/);
  if (cl) return Math.max(1, 7 - Number(cl[1]));
  if (/maiden|mdn/.test(c)) return 1;
  if (/handicap|hcp|open/.test(c)) return 5;
  return null;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
function std(xs: number[]) {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
/** 1 = won, 0 = last. */
export function runScore(p: Perf): number | null {
  if (!p.finish_position || p.finish_position < 1) return null;
  const field = Math.max(p.field_size ?? 0, p.finish_position);
  if (field <= 1) return 1;
  return 1 - (p.finish_position - 1) / (field - 1);
}
/** Win rate pulled towards a typical rate when there are few runs, so 1 win from 1 start isn't "100%". */
export const shrunkRate = (wins: number, starts: number, prior = 0.1, weight = 8) => (wins + prior * weight) / (starts + weight);

export interface Split { starts: number; wins: number; places: number; winPct: number | null; score: number | null }
function split(perfs: Perf[]): Split {
  const scored = perfs.filter((p) => runScore(p) != null);
  const wins = scored.filter((p) => p.finish_position === 1).length;
  const places = scored.filter((p) => (p.finish_position ?? 99) <= 3).length;
  return { starts: scored.length, wins, places, winPct: scored.length ? wins / scored.length : null, score: mean(scored.map((p) => runScore(p)!)) };
}

export interface RaceContext {
  date: string;
  racecourse_id?: string | null;
  distance_m?: number | null;
  surface?: string | null;
  track: TrackGroup;
  race_class?: string | null;
  weight_kg?: number | null;
  barrier?: number | null;
}

export interface HorseForm {
  starts: number; wins: number; places: number;
  winPct: number | null; placePct: number | null; winRate: number;
  recentForm: number | null; consistency: number | null; trend: number | null;
  daysSinceLast: number | null; avgMargin: number | null; speedMs: number | null;
  classDelta: number | null;
  distance: Split; course: Split; condition: Split; surface: Split; barrierBand: Split;
  weightDiff: number | null; dataQuality: number;
  lastStarts: Array<{ date: string; finish: number | null; field: number | null }>;
}

const barrierBand = (b?: number | null) => (b == null ? null : b <= 4 ? "inside" : b <= 9 ? "middle" : "wide");

/** Engine 2 (+ Engine 4's condition cross-check) for one horse. */
export function horseForm(all: Perf[], ctx: RaceContext): HorseForm {
  const past = all.filter((p) => p.race_date < ctx.date && runScore(p) != null).sort((a, b) => (a.race_date < b.race_date ? 1 : -1));
  const s = split(past);
  const recent = past.slice(0, 6);
  let wsum = 0, w = 0;
  recent.forEach((p, i) => { const wt = Math.pow(0.5, i / 3); wsum += wt * runScore(p)!; w += wt; });
  const scores = recent.map((p) => runScore(p)!);
  // Trend: slope of score over the last runs, oldest → newest (positive = improving).
  let trend: number | null = null;
  if (scores.length >= 3) {
    const ys = [...scores].reverse();
    const xm = (ys.length - 1) / 2, ym = mean(ys)!;
    let num = 0, den = 0;
    ys.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
    trend = den ? num / den : 0;
  }
  const sd = std(scores);
  const near = past.filter((p) => ctx.distance_m && p.distance_m && Math.abs(p.distance_m - ctx.distance_m) <= 200);
  const speeds = near.filter((p) => p.race_time_s && p.distance_m).map((p) => p.distance_m! / p.race_time_s!);
  const weights = past.map((p) => Number(p.weight_kg)).filter((x) => Number.isFinite(x) && x > 0);
  const losers = past.filter((p) => (p.finish_position ?? 0) > 1 && p.margin_lengths != null).map((p) => Number(p.margin_lengths));
  const todayClass = classLevel(ctx.race_class);
  const pastClass = mean(recent.map((p) => classLevel(p.race_class)).filter((x): x is number => x != null));
  const band = barrierBand(ctx.barrier);
  return {
    starts: s.starts, wins: s.wins, places: s.places,
    winPct: s.winPct, placePct: s.starts ? s.places / s.starts : null, winRate: shrunkRate(s.wins, s.starts),
    recentForm: w ? wsum / w : null,
    consistency: sd == null ? null : Math.max(0, 1 - sd * 2),
    trend,
    daysSinceLast: past[0] ? daysBetween(past[0].race_date, ctx.date) : null,
    avgMargin: mean(losers),
    speedMs: mean(speeds),
    classDelta: todayClass != null && pastClass != null ? pastClass - todayClass : null,
    distance: split(near),
    course: split(past.filter((p) => ctx.racecourse_id && p.racecourse_id === ctx.racecourse_id)),
    condition: split(ctx.track === "unknown" ? [] : past.filter((p) => trackGroup(p.track_rating) === ctx.track)),
    surface: split(past.filter((p) => ctx.surface && p.surface && p.surface.toLowerCase() === ctx.surface.toLowerCase())),
    barrierBand: split(band ? past.filter((p) => barrierBand(p.barrier) === band) : []),
    weightDiff: ctx.weight_kg && weights.length ? Number(ctx.weight_kg) - mean(weights)! : null,
    dataQuality: Math.min(1, s.starts / 6),
    lastStarts: recent.map((p) => ({ date: p.race_date, finish: p.finish_position ?? null, field: p.field_size ?? null })),
  };
}

export interface PeopleStats { rides: number; wins: number; winPct: number | null; winRate: number; recentWinPct: number | null; courseWinPct: number | null; distanceWinPct: number | null }

/** Engine 5: jockey or trainer record from their past runs (any horse), before the race date. */
export function peopleStats(all: Perf[], ctx: RaceContext): PeopleStats {
  const past = all.filter((p) => p.race_date < ctx.date && runScore(p) != null);
  const s = split(past);
  const recent = split(past.filter((p) => daysBetween(p.race_date, ctx.date) <= 90));
  const course = split(past.filter((p) => ctx.racecourse_id && p.racecourse_id === ctx.racecourse_id));
  const dist = split(past.filter((p) => ctx.distance_m && p.distance_m && Math.abs(p.distance_m - ctx.distance_m) <= 200));
  return { rides: s.starts, wins: s.wins, winPct: s.winPct, winRate: shrunkRate(s.wins, s.starts), recentWinPct: recent.winPct, courseWinPct: course.winPct, distanceWinPct: dist.winPct };
}

export type RunStyle = "leader" | "on-pace" | "midfield" | "backmarker" | "unknown";

/** Running style from early positions the data source recorded (never guessed). */
export function runStyle(perfs: Perf[], date: string): RunStyle {
  const pos = perfs.filter((p) => p.race_date < date && p.settled != null && p.settled > 0).slice(0, 6).map((p) => Number(p.settled));
  const m = mean(pos);
  if (m == null) return "unknown";
  if (m <= 2) return "leader";
  if (m <= 4.5) return "on-pace";
  if (m <= 8) return "midfield";
  return "backmarker";
}

export interface PaceMap { leaders: number; known: number; pace: "hot" | "even" | "soft" | "unknown"; favours: RunStyle[] }
export function paceMap(styles: RunStyle[]): PaceMap {
  const known = styles.filter((s) => s !== "unknown").length;
  const leaders = styles.filter((s) => s === "leader").length;
  if (known < Math.max(3, styles.length / 2)) return { leaders, known, pace: "unknown", favours: [] };
  if (leaders >= 3) return { leaders, known, pace: "hot", favours: ["midfield", "backmarker"] };
  if (leaders <= 1) return { leaders, known, pace: "soft", favours: ["leader", "on-pace"] };
  return { leaders, known, pace: "even", favours: [] };
}

/** Paddock / training observation words → 0..1 scores (1 = better sign). */
export function visionScores(m: Record<string, unknown> | null | undefined) {
  const v = (x: unknown) => String(x ?? "").toLowerCase();
  const calm = { calm: 1, alert: 0.7, "on edge": 0.3, agitated: 0 } as Record<string, number>;
  const sweat = { none: 1, light: 0.6, heavy: 0.1 } as Record<string, number>;
  const walk = (s: string) => (/relaxed|even|fluent|smooth/.test(s) ? 1 : /short|choppy|uneven|laboured|irregular/.test(s) ? 0.2 : null);
  return {
    calm: calm[v(m?.calmness)] ?? null,
    sweat: sweat[v(m?.sweating)] ?? null,
    walk: walk(v(m?.walk ?? m?.movement)),
  };
}

// ---------- Model features ----------
export const FEATURE_NAMES = [
  "recent_form", "win_rate", "place_rate", "consistency", "trend", "distance_score", "course_score",
  "condition_score", "days_since_last", "weight_diff", "barrier", "speed", "class_delta",
  "jockey_rate", "trainer_rate", "combo_rate", "sire_distance", "pace_fit", "market",
  "paddock", "training", "no_form", "no_market",
] as const;
export type Scenario = "A" | "B" | "C" | "D";
const VISION_FEATURES: Record<Scenario, string[]> = { A: [], B: ["paddock"], C: ["training"], D: ["paddock", "training"] };

export interface RunnerInputs {
  form: HorseForm;
  jockey?: PeopleStats | null;
  trainer?: PeopleStats | null;
  combo?: PeopleStats | null;
  sireDistance?: Split | null;
  paceFit?: number | null; // +1 style favoured, -1 against, 0 neutral
  barrier?: number | null;
  marketProb?: number | null; // normalised implied chance from pre-race price
  paddock?: number | null; // 0..1
  training?: number | null; // 0..1
}

/** Raw (un-normalised) feature values; null = unavailable. */
export function rawFeatures(r: RunnerInputs, scenario: Scenario): Array<number | null> {
  const f = r.form;
  const allowed = new Set(VISION_FEATURES[scenario]);
  const val: Record<string, number | null> = {
    recent_form: f.recentForm,
    win_rate: f.starts ? f.winRate : null,
    place_rate: f.starts ? (f.places + 0.3 * 8) / (f.starts + 8) : null,
    consistency: f.consistency,
    trend: f.trend,
    distance_score: f.distance.starts ? f.distance.score : null,
    course_score: f.course.starts ? f.course.score : null,
    condition_score: f.condition.starts ? f.condition.score : null,
    days_since_last: f.daysSinceLast == null ? null : Math.log1p(Math.max(0, f.daysSinceLast)),
    weight_diff: f.weightDiff,
    barrier: r.barrier ?? null,
    speed: f.speedMs,
    class_delta: f.classDelta,
    jockey_rate: r.jockey?.rides ? r.jockey.winRate : null,
    trainer_rate: r.trainer?.rides ? r.trainer.winRate : null,
    combo_rate: r.combo?.rides ? r.combo.winRate : null,
    sire_distance: r.sireDistance?.starts ? r.sireDistance.score : null,
    pace_fit: r.paceFit ?? null,
    market: r.marketProb != null && r.marketProb > 0 ? Math.log(r.marketProb) : null,
    paddock: allowed.has("paddock") ? r.paddock ?? null : null,
    training: allowed.has("training") ? r.training ?? null : null,
    no_form: f.starts === 0 ? 1 : 0,
    no_market: r.marketProb != null && r.marketProb > 0 ? 0 : 1,
  };
  return FEATURE_NAMES.map((n) => val[n]);
}

/**
 * Compare runners within the same race: each feature becomes "how far above or
 * below this field's average" (z-score). Missing values sit at the field average.
 */
export function normaliseWithinRace(rows: Array<Array<number | null>>): number[][] {
  const k = FEATURE_NAMES.length;
  const out = rows.map(() => new Array(k).fill(0));
  for (let j = 0; j < k; j++) {
    const name = FEATURE_NAMES[j];
    if (name === "no_form" || name === "no_market") { rows.forEach((r, i) => { out[i][j] = Number(r[j] ?? 0); }); continue; }
    const vals = rows.map((r) => r[j]).filter((x): x is number => x != null && Number.isFinite(x));
    if (vals.length < 2) continue;
    const m = vals.reduce((s, x) => s + x, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length) || 1;
    rows.forEach((r, i) => { const x = r[j]; out[i][j] = x == null || !Number.isFinite(x) ? 0 : Math.max(-4, Math.min(4, (x - m) / sd)); });
  }
  return out;
}

/** Market prices → chances that add up to 1 (bookmaker margin removed). */
export function marketProbabilities(odds: Array<number | null | undefined>): Array<number | null> {
  const raw = odds.map((o) => (o != null && Number.isFinite(o) && o > 1 ? 1 / o : null));
  const total = raw.reduce<number>((s, x) => s + (x ?? 0), 0);
  return raw.map((x) => (x != null && total > 0 ? x / total : null));
}
