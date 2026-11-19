// Oracle Racing — daily broadcast selection rules. Pure functions shared by
// the controller and the screens, so every rule is tested in one place.
// The $3.00 minimum win price is a floor that settings can raise, never lower.

export const ODDS_FLOOR = 3.0;

export interface SelectionSettings {
  min_win_odds: number;        // never below ODDS_FLOOR
  min_confidence: number;      // 0–100 analytical confidence (not a probability)
  min_expected_value: number;  // e.g. 0.05 = +5% per $1
}

export const DEFAULT_SELECTION: SelectionSettings = { min_win_odds: 3.0, min_confidence: 60, min_expected_value: 0.05 };

/** The active minimum price: the setting, but never under $3.00. */
export const effectiveMinOdds = (s?: Partial<SelectionSettings> | null) => Math.max(ODDS_FLOOR, Number(s?.min_win_odds) || ODDS_FLOOR);

const cents = (x: number) => Math.round(x * 100);
/** $3.00 passes, $2.90 fails. Compared in whole cents so 2.999999 never sneaks through. */
export const meetsOddsFloor = (odds: number | null | undefined, min = ODDS_FLOOR) =>
  odds != null && Number.isFinite(odds) && cents(odds) >= cents(Math.max(ODDS_FLOOR, min));

export const impliedProbability = (odds: number) => (odds > 1 ? 1 / odds : null);

/** Market chances with the bookmaker's margin (overround) removed. */
export function overroundAdjusted(prices: Array<number | null | undefined>): { probs: Array<number | null>; overround: number | null } {
  const raw = prices.map((p) => (p != null && p > 1 ? 1 / p : null));
  const known = raw.filter((x): x is number => x != null);
  if (known.length < 2) return { probs: raw, overround: null };
  const book = known.reduce((a, b) => a + b, 0);
  // Only rescale when the whole field is priced; a partial book can't be normalised honestly.
  if (known.length !== raw.length) return { probs: raw, overround: book };
  return { probs: raw.map((x) => (x == null ? null : x / book)), overround: book };
}

/** Expected value per $1: (Oracle win probability × decimal odds) − 1. */
export const expectedValue = (p: number, odds: number) => p * odds - 1;

export interface RunnerCandidate {
  odds: number | null; oracleProb: number | null; confidence: number | null; scratched?: boolean;
}
export interface Evaluation { decision: "qualified" | "rejected"; reasons: string[]; ev: number | null; implied: number | null }

const money = (x: number) => `$${x.toFixed(2)}`;

/** Every rule, in order. A runner qualifies only if it passes all of them. */
export function evaluateRunner(c: RunnerCandidate, settings: Partial<SelectionSettings> | null | undefined, opts: { applyConfidence?: boolean } = {}): Evaluation {
  const s = { ...DEFAULT_SELECTION, ...(settings ?? {}) };
  const minOdds = effectiveMinOdds(s);
  const reasons: string[] = [];
  const implied = c.odds != null ? impliedProbability(c.odds) : null;
  const ev = c.oracleProb != null && c.odds != null ? expectedValue(c.oracleProb, c.odds) : null;
  if (c.scratched) reasons.push("Scratched.");
  if (c.odds == null) reasons.push("No available win price.");
  else if (!meetsOddsFloor(c.odds, minOdds)) reasons.push(`Price ${money(c.odds)} is below the ${money(minOdds)} minimum.`);
  if (c.oracleProb == null) reasons.push("No tested Oracle win probability (no model has passed testing yet).");
  else if (ev != null && !(ev > Math.max(0, s.min_expected_value))) reasons.push(`Expected value ${(ev * 100).toFixed(1)}% is not above the ${(Math.max(0, s.min_expected_value) * 100).toFixed(1)}% minimum.`);
  if (opts.applyConfidence !== false) {
    if (c.confidence == null) reasons.push("No confidence score.");
    else if (c.confidence < s.min_confidence) reasons.push(`Confidence ${Math.round(c.confidence)} is below the ${s.min_confidence} minimum.`);
  }
  return { decision: reasons.length ? "rejected" : "qualified", reasons, ev, implied };
}

export type ReportStatus = "qualifying" | "in_progress" | "no_winners" | "data_unavailable";
export const STATUS_TEXT: Record<ReportStatus, string> = {
  qualifying: "QUALIFYING SELECTIONS AVAILABLE",
  in_progress: "ANALYSIS IN PROGRESS",
  no_winners: "NO AVAILABLE MATCHING WINNERS TODAY",
  data_unavailable: "DATA UNAVAILABLE – RETRY REQUIRED",
};

/**
 * "No matching winners" is only allowed when every eligible race was fully
 * analysed (field, prices and tested probabilities). Any data failure is
 * reported as data unavailable instead.
 */
export function reportStatus(x: { inProgress?: boolean; eligibleRaces: number; fullyAnalysedRaces: number; qualifying: number; dataProblems: number }): ReportStatus {
  if (x.inProgress) return "in_progress";
  if (x.qualifying > 0) return "qualifying";
  if (x.eligibleRaces === 0 || x.dataProblems > 0 || x.fullyAnalysedRaces < x.eligibleRaces) return "data_unavailable";
  return "no_winners";
}

/** Official parade time if known, else start minus a configurable lead, clearly marked as an estimate. */
export function paradeTime(startIso: string, officialIso: string | null | undefined, leadMinutes: number): { at: string; official: boolean; note: string } {
  if (officialIso) return { at: officialIso, official: true, note: "Official parade time" };
  const lead = Math.max(1, Math.round(leadMinutes || 15));
  return { at: new Date(Date.parse(startIso) - lead * 60_000).toISOString(), official: false, note: `Estimated: ${lead} min before the start (not official)` };
}

/** "1-8", "3,4,7" or "1-3,6" → [1,2,3,6]. Empty means every race at the meeting. */
export function parseRaceList(v: string | null | undefined): number[] {
  const out = new Set<number>();
  for (const part of String(v ?? "").split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
    if (!m) continue;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= 15; i++) if (i >= 1) out.add(i);
  }
  return [...out].sort((a, b) => a - b);
}

export const BROADCAST_STATUSES = ["confirmed_live", "scheduled", "replay", "unconfirmed"] as const;
export type BroadcastStatus = typeof BROADCAST_STATUSES[number];
/** Only confirmed or scheduled live coverage counts; replays and unconfirmed listings never do. */
export const broadcastCounts = (s: string) => s === "confirmed_live" || s === "scheduled";

export function normaliseBroadcastStatus(v?: string): BroadcastStatus {
  const s = String(v ?? "").trim().toLowerCase();
  if (/^(confirmed|live|confirmed[_ ]live)$/.test(s)) return "confirmed_live";
  if (/^sched/.test(s)) return "scheduled";
  if (/^(replay|repeat|encore)/.test(s)) return "replay";
  return "unconfirmed";
}

/** Thoroughbred only — greyhounds, harness/trots and other sports are refused. */
export function isThoroughbred(code?: string | null): boolean {
  const s = String(code ?? "").trim().toLowerCase();
  if (!s) return true; // the template defaults to thoroughbred
  return /^(thoroughbred|gallops?|horse racing|tb|flat|jumps?)$/.test(s);
}

/** Calendar date (YYYY-MM-DD) in a timezone — the "racing day" boundary. */
export function localDate(tz: string, at: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const g = (k: string) => p.find((x) => x.type === k)?.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}
/** "HH:MM" local time-of-day now in a timezone. */
export function localTime(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

export interface SettledBet { decided_at: string; odds: number; won: boolean }
/** $1 flat win bets. Deduction is a % taken from winnings (e.g. exchange commission). */
export function flatBetStats(bets: SettledBet[], deductionPct = 0) {
  const sorted = [...bets].sort((a, b) => (a.decided_at < b.decided_at ? -1 : 1));
  let bank = 0, peak = 0, maxDrawdown = 0, returns = 0, winners = 0, oddsSum = 0;
  const cut = Math.min(Math.max(deductionPct, 0), 100) / 100;
  for (const b of sorted) {
    const ret = b.won ? 1 + (b.odds - 1) * (1 - cut) : 0;
    if (b.won) winners++;
    returns += ret; oddsSum += b.odds;
    bank += ret - 1;
    peak = Math.max(peak, bank);
    maxDrawdown = Math.max(maxDrawdown, peak - bank);
  }
  const n = sorted.length;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    selections: n, winners, losers: n - winners, strikeRate: n ? winners / n : null, averageOdds: n ? r2(oddsSum / n) : null,
    staked: n, returns: r2(returns), netProfit: r2(returns - n), roi: n ? (returns - n) / n : null, maxDrawdown: r2(maxDrawdown),
  };
}
