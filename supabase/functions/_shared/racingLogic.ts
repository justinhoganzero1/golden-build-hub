// Pure Oracle Racing rules (no network, no database) so they can be tested.

export type SelectionMode = "all" | "top5" | "top10" | "top20" | "custom";

export interface RaceEvidence {
  runners: number;               // non-scratched runners in the field
  runnersWithForm: number;       // runners with >= 3 verified past performances
  runnersWithJockey: number;
  hasOfficialTrackRating: boolean;
  hasRecentWeather: boolean;     // weather within the last 3 hours
  hasPaddockVideo: boolean;
  hasTrainingVideo: boolean;
  modelValidated: boolean;       // a tested predictive model exists
}

export interface Suitability { score: number; completeness: number; reasons: string[] }

/**
 * Race Intelligence Suitability Score (0-100). It measures how much reliable
 * information exists, NOT how likely any horse is to win.
 */
export function suitabilityScore(e: RaceEvidence): Suitability {
  const reasons: string[] = [];
  if (e.runners <= 0) return { score: 0, completeness: 0, reasons: ["No confirmed field yet."] };
  const form = e.runnersWithForm / e.runners;
  const jockey = e.runnersWithJockey / e.runners;
  const parts: Array<[number, number, string, string]> = [
    [35, form, `${Math.round(form * 100)}% of runners have enough verified past races.`, "Few runners have verified past races."],
    [10, jockey, `${Math.round(jockey * 100)}% of runners have a confirmed jockey.`, "Jockeys not confirmed."],
    [10, e.hasOfficialTrackRating ? 1 : 0, "Official track rating available.", "No official track rating."],
    [10, e.hasRecentWeather ? 1 : 0, "Current weather available.", "No recent weather."],
    [10, e.hasPaddockVideo ? 1 : 0, "Authorised paddock video available.", "No authorised paddock video."],
    [10, e.hasTrainingVideo ? 1 : 0, "Training footage available.", "No training footage."],
    [15, e.modelValidated ? 1 : 0, "A tested prediction model is available.", "No tested prediction model yet."],
  ];
  let score = 0;
  for (const [weight, value, good, bad] of parts) {
    score += weight * value;
    reasons.push(value >= 0.6 ? good : bad);
  }
  if (e.runners < 4) reasons.push("Very small field: rankings carry little information.");
  const completeness = (form + jockey + (e.hasOfficialTrackRating ? 1 : 0) + (e.hasRecentWeather ? 1 : 0)) / 4;
  return { score: Math.round(score), completeness: Math.round(completeness * 100), reasons };
}

export function selectionCount(mode: SelectionMode, custom: number, total: number): number {
  const n = mode === "all" ? total : mode === "top5" ? 5 : mode === "top10" ? 10 : mode === "top20" ? 20 : Math.max(1, Math.floor(custom));
  return Math.min(n, total);
}

/** Pick the races with the strongest analytical suitability. */
export function selectRaces<T extends { id: string; score: number }>(races: T[], mode: SelectionMode, custom: number): string[] {
  const n = selectionCount(mode, custom, races.length);
  return [...races].sort((a, b) => b.score - a.score).slice(0, n).map((r) => r.id);
}

export type JobKind = "morning" | "t30" | "t20" | "t10" | "t5" | "post";

/** Race-day timetable: preparation, refreshes, paddock, final lock at T-5, results after. */
export function raceDayJobs(startUtc: Date, now: Date): Array<{ kind: JobKind; due: Date }> {
  const at = (mins: number) => new Date(startUtc.getTime() + mins * 60_000);
  const morning = at(-6 * 60);
  return [
    { kind: "morning" as JobKind, due: morning < now ? now : morning },
    { kind: "t30" as JobKind, due: at(-30) },
    { kind: "t20" as JobKind, due: at(-20) },
    { kind: "t10" as JobKind, due: at(-10) },
    { kind: "t5" as JobKind, due: at(-5) },
    { kind: "post" as JobKind, due: at(25) },
  ];
}

/** Evidence recorded after the race start can never feed a pre-race prediction. */
export function usableBeforeRace(evidenceTime: Date, raceStart: Date): boolean {
  return evidenceTime.getTime() < raceStart.getTime();
}

/** Compare a locked prediction with the official result. */
export function scorePrediction(predicted: string[], actual: string[]) {
  const winnerHit = predicted[0] !== undefined && predicted[0] === actual[0];
  const top2Hit = predicted.length >= 2 && actual.length >= 2 && new Set(predicted.slice(0, 2)).size === 2 &&
    predicted.slice(0, 2).every((r) => actual.slice(0, 2).includes(r));
  const top3Hit = predicted.length >= 3 && actual.length >= 3 && predicted.slice(0, 3).every((r) => actual.slice(0, 3).includes(r));
  const exactaHit = predicted[0] === actual[0] && predicted[1] !== undefined && predicted[1] === actual[1];
  // Spearman rank correlation over runners present in both lists.
  const common = predicted.filter((r) => actual.includes(r));
  let rankCorrelation: number | null = null;
  if (common.length >= 2) {
    const n = common.length;
    const pr = new Map(common.map((r, i) => [r, i]));
    const ar = new Map(actual.filter((r) => pr.has(r)).map((r, i) => [r, i]));
    let d2 = 0;
    for (const r of common) d2 += ((pr.get(r) ?? 0) - (ar.get(r) ?? 0)) ** 2;
    rankCorrelation = 1 - (6 * d2) / (n * (n * n - 1));
  }
  return { winnerHit, top2Hit, top3Hit, exactaHit, rankCorrelation };
}

/**
 * Statistics-only baseline used for back-test trials: rank runners by their
 * pre-race betting price (shortest first). It is the market's opinion, not a
 * trained model, and serves as the bar any real Oracle model must beat.
 */
export function marketBaselineRank<T extends { id: string; odds: number | null; saddlecloth: number }>(runners: T[]): string[] {
  return [...runners]
    .filter((r) => r.odds != null && Number.isFinite(r.odds) && (r.odds as number) > 1)
    .sort((a, b) => (a.odds as number) - (b.odds as number) || a.saddlecloth - b.saddlecloth)
    .map((r) => r.id);
}
