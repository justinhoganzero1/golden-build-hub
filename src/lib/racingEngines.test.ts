import { describe, it, expect } from "vitest";
import { horseForm, trackGroup, peopleStats, paceMap, marketProbabilities, normaliseWithinRace, rawFeatures, FEATURE_NAMES, classLevel } from "../../supabase/functions/_shared/racingFeatures";
import { trainConditionalLogit, predictRace, placeProbabilities, passesValidation, trainAndTest, analyticalConfidence, MIN_TEST_RACES, seededRandom, type TrainingRace } from "../../supabase/functions/_shared/racingModel";
import { parseCsv, normaliseRaceRows, zonedToUtc, normaliseDate, normaliseFinish } from "../../supabase/functions/_shared/racingImport";

const ctx = { date: "2025-11-04", distance_m: 3200, racecourse_id: "flem", track: "soft" as const };

describe("horse form never uses future races", () => {
  it("ignores a run on or after race day", () => {
    const f = horseForm([
      { race_date: "2025-10-18", finish_position: 1, field_size: 18 },
      { race_date: "2025-11-04", finish_position: 1, field_size: 24 },
      { race_date: "2025-11-20", finish_position: 1, field_size: 10 },
    ], ctx);
    expect(f.starts).toBe(1);
    expect(f.daysSinceLast).toBe(17);
  });
  it("scores last place as 0 and a win as 1", () => {
    const f = horseForm([{ race_date: "2025-01-01", finish_position: 10, field_size: 10 }], ctx);
    expect(f.recentForm).toBe(0);
  });
});

describe("track conditions are grouped across countries", () => {
  it("maps Australian numbers and UK words", () => {
    expect(trackGroup("Good 4")).toBe("good");
    expect(trackGroup("Soft 7")).toBe("soft");
    expect(trackGroup("Heavy 10")).toBe("heavy");
    expect(trackGroup("Good to Firm")).toBe("firm");
    expect(trackGroup("Polytrack")).toBe("synthetic");
  });
  it("ranks Group 1 above a maiden", () => {
    expect(classLevel("Group 1")!).toBeGreaterThan(classLevel("Maiden")!);
  });
});

describe("jockey record", () => {
  it("counts wins only before the race", () => {
    const s = peopleStats([{ race_date: "2025-01-01", finish_position: 1, field_size: 8 }, { race_date: "2025-12-01", finish_position: 1, field_size: 8 }, { race_date: "2025-02-01", finish_position: 5, field_size: 8 }], ctx);
    expect(s.rides).toBe(2);
    expect(s.winPct).toBe(0.5);
  });
});

describe("pace map", () => {
  it("calls three or more leaders a hot pace", () => {
    expect(paceMap(["leader", "leader", "leader", "midfield"]).pace).toBe("hot");
  });
  it("says unknown when most styles are unknown", () => {
    expect(paceMap(["leader", "unknown", "unknown", "unknown"]).pace).toBe("unknown");
  });
});

describe("market chances", () => {
  it("removes the bookmaker margin so chances add to 1", () => {
    const p = marketProbabilities([2, 3, 4]);
    expect((p[0]! + p[1]! + p[2]!)).toBeCloseTo(1, 6);
  });
});

describe("features are compared within the race", () => {
  it("puts missing values at the field average", () => {
    const f = horseForm([], ctx);
    const rows = [rawFeatures({ form: f, barrier: 1 }, "A"), rawFeatures({ form: f, barrier: 9 }, "A"), rawFeatures({ form: f, barrier: null }, "A")];
    const z = normaliseWithinRace(rows);
    const j = FEATURE_NAMES.indexOf("barrier");
    expect(z[2][j]).toBe(0);
    expect(z[0][j]).toBeLessThan(0);
  });
  it("keeps paddock video out of the statistics-only scenario", () => {
    const f = horseForm([], ctx);
    expect(rawFeatures({ form: f, paddock: 1 }, "A")[FEATURE_NAMES.indexOf("paddock")]).toBeNull();
    expect(rawFeatures({ form: f, paddock: 1 }, "B")[FEATURE_NAMES.indexOf("paddock")]).toBe(1);
  });
});

function syntheticRaces(n: number, seed = 1): TrainingRace[] {
  const rnd = seededRandom(seed);
  return Array.from({ length: n }, (_, i) => {
    const x = Array.from({ length: 8 }, () => [rnd() * 2 - 1, rnd() * 2 - 1]);
    // Runner with the highest first feature usually wins.
    const scores = x.map((r) => r[0] * 3 + (rnd() - 0.5));
    const order = scores.map((s, j) => ({ s, j })).sort((a, b) => b.s - a.s).map((o) => o.j);
    return { id: `r${i}`, date: `2024-01-${String((i % 28) + 1).padStart(2, "0")}T${String(i).padStart(5, "0")}`, x, winner: order[0], order };
  });
}

describe("master model", () => {
  it("learns that a useful feature matters and a random one doesn't", () => {
    const w = trainConditionalLogit(syntheticRaces(300));
    expect(w[0]).toBeGreaterThan(1);
    expect(Math.abs(w[1])).toBeLessThan(0.5);
  });
  it("gives chances that add up to 1", () => {
    const p = predictRace([1, 0], [[1, 0], [0, 0], [-1, 0]]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(p[0]).toBeGreaterThan(p[2]);
  });
  it("top-4 chances grow from win to top 4 and the favourite stays ahead", () => {
    const pl = placeProbabilities([0.5, 0.3, 0.1, 0.05, 0.05]);
    expect(pl[0].top4).toBeGreaterThanOrEqual(pl[0].top1);
    expect(pl[0].top1).toBeGreaterThan(pl[1].top1);
    expect(pl.reduce((s, r) => s + r.top1, 0)).toBeCloseTo(1, 6);
  });
  it("refuses live use with fewer than 100 unseen test races", () => {
    const v = passesValidation({ races: 99, logLoss: 1, brier: 0, winner: 0.5, top2: 0, top3: 0, exacta: 0, rankCorrelation: 0 }, { races: 99, logLoss: 2, brier: 0, winner: 0.1, top2: 0, top3: 0, exacta: 0, rankCorrelation: 0 }, null, 0);
    expect(MIN_TEST_RACES).toBe(100);
    expect(v.ok).toBe(false);
  });
  it("refuses live use when it doesn't beat the betting market", () => {
    const e = (ll: number) => ({ races: 200, logLoss: ll, brier: 0, winner: 0, top2: 0, top3: 0, exacta: 0, rankCorrelation: 0 });
    expect(passesValidation(e(1.9), e(2.1), e(1.8), 0.9).ok).toBe(false);
    expect(passesValidation(e(1.7), e(2.1), e(1.8), 0.9).ok).toBe(true);
  });
  it("tests only on the newest races it never trained on", () => {
    const r = trainAndTest(syntheticRaces(600))!;
    expect(r.split.test).toBe(150);
    expect(r.test.winner!).toBeGreaterThan(0.3);
    expect(r.validation.ok).toBe(true);
  });
  it("confidence reflects evidence, not a horse's chance", () => {
    expect(analyticalConfidence([1, 1, 1], 0.5)).toBe(50);
    expect(analyticalConfidence([], 1)).toBe(0);
  });
});

describe("spreadsheet import", () => {
  it("reads quoted cells with commas", () => {
    const rows = parseCsv('date,racecourse,race_number,horse,trainer\n2025-11-04,Flemington,7,Half Yours,"McEvoy, Tony"\n');
    expect(rows[0].trainer).toBe("McEvoy, Tony");
  });
  it("needs date, course, race and horse", () => {
    const { rows, problems } = normaliseRaceRows([{ date: "4/11/2025", racecourse: "Flemington", race_number: "7", horse: "Half Yours", finish_position: "1st" }, { horse: "No Date" }]);
    expect(rows[0].date).toBe("2025-11-04");
    expect(rows[0].finish_position).toBe(1);
    expect(problems.length).toBe(1);
  });
  it("treats scratched and non-finishers as no position", () => {
    expect(normaliseFinish("SCR")).toBeNull();
    expect(normaliseFinish("DNF")).toBeNull();
    expect(normaliseDate("2025-1-5")).toBe("2025-01-05");
  });
  it("converts Melbourne Cup 3pm local time to 04:00 UTC (daylight saving)", () => {
    expect(zonedToUtc("2025-11-04", "15:00", "Australia/Melbourne")).toBe("2025-11-04T04:00:00.000Z");
    expect(zonedToUtc("2025-07-01", "15:00", "Australia/Brisbane")).toBe("2025-07-01T05:00:00.000Z");
  });
});
