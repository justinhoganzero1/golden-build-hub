import { describe, it, expect } from "vitest";
import { suitabilityScore, selectRaces, raceDayJobs, usableBeforeRace, scorePrediction, marketBaselineRank } from "../../supabase/functions/_shared/racingLogic";

const full = { runners: 10, runnersWithForm: 10, runnersWithJockey: 10, hasOfficialTrackRating: true, hasRecentWeather: true, hasPaddockVideo: true, hasTrainingVideo: true, modelValidated: true };

describe("racing suitability", () => {
  it("scores a fully documented race 100", () => {
    expect(suitabilityScore(full).score).toBe(100);
  });
  it("scores a race with no field 0", () => {
    expect(suitabilityScore({ ...full, runners: 0 }).score).toBe(0);
  });
  it("loses 15 points without a tested model", () => {
    expect(suitabilityScore({ ...full, modelValidated: false }).score).toBe(85);
  });
});

describe("race selection", () => {
  const races = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, score: i }));
  it("top 5 picks the five highest scores", () => {
    expect(selectRaces(races, "top5", 0)).toEqual(["r29", "r28", "r27", "r26", "r25"]);
  });
  it("all picks every race", () => {
    expect(selectRaces(races, "all", 0)).toHaveLength(30);
  });
  it("custom count is respected", () => {
    expect(selectRaces(races, "custom", 7)).toHaveLength(7);
  });
});

describe("race-day timing", () => {
  it("locks the final prediction 5 minutes before the start", () => {
    const start = new Date("2026-11-20T05:00:00Z");
    const jobs = raceDayJobs(start, new Date("2026-11-20T00:00:00Z"));
    expect(jobs.find((j) => j.kind === "t5")?.due.toISOString()).toBe("2026-11-20T04:55:00.000Z");
    expect(jobs.find((j) => j.kind === "t30")?.due.toISOString()).toBe("2026-11-20T04:30:00.000Z");
  });
  it("never uses footage recorded after the start", () => {
    const start = new Date("2026-11-20T05:00:00Z");
    expect(usableBeforeRace(new Date("2026-11-20T05:01:00Z"), start)).toBe(false);
    expect(usableBeforeRace(new Date("2026-11-20T04:40:00Z"), start)).toBe(true);
  });
});

describe("prediction scoring", () => {
  it("counts winner, exacta and top three hits", () => {
    const s = scorePrediction(["a", "b", "c", "d"], ["a", "b", "d", "c"]);
    expect(s.winnerHit).toBe(true);
    expect(s.exactaHit).toBe(true);
    expect(s.top3Hit).toBe(false);
  });
});

describe("market baseline back-test ranking", () => {
  it("puts the shortest price first and breaks ties by saddlecloth number", () => {
    const order = marketBaselineRank([
      { id: "b", odds: 11, saddlecloth: 24 }, { id: "a", odds: 5.5, saddlecloth: 1 },
      { id: "c", odds: 11, saddlecloth: 2 }, { id: "x", odds: null, saddlecloth: 3 },
    ]);
    expect(order).toEqual(["a", "c", "b"]);
  });
});
