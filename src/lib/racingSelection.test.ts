import { describe, it, expect } from "vitest";
import {
  ODDS_FLOOR, meetsOddsFloor, effectiveMinOdds, evaluateRunner, expectedValue, impliedProbability, overroundAdjusted,
  reportStatus, paradeTime, parseRaceList, broadcastCounts, normaliseBroadcastStatus, isThoroughbred, flatBetStats, localDate,
} from "../../supabase/functions/_shared/racingSelection";

describe("$3.00 minimum win price", () => {
  it("rejects $1.50, $2.00, $2.50 and $2.90", () => {
    for (const o of [1.5, 2.0, 2.5, 2.9]) expect(meetsOddsFloor(o)).toBe(false);
  });
  it("lets $3.00, $3.50, $5.00 and $10.00 through to further analysis", () => {
    for (const o of [3.0, 3.5, 5.0, 10.0]) expect(meetsOddsFloor(o)).toBe(true);
  });
  it("never lets a price just under $3.00 sneak through", () => {
    expect(meetsOddsFloor(2.99)).toBe(false);
  });
  it("cannot be lowered by settings, only raised", () => {
    expect(effectiveMinOdds({ min_win_odds: 2.5 })).toBe(ODDS_FLOOR);
    expect(meetsOddsFloor(2.8, 2.5)).toBe(false);
    expect(effectiveMinOdds({ min_win_odds: 4 })).toBe(4);
    expect(meetsOddsFloor(3.5, 4)).toBe(false);
  });
});

describe("value and probability", () => {
  it("expected value = (Oracle probability × odds) − 1", () => {
    expect(expectedValue(0.4, 3)).toBeCloseTo(0.2);
    expect(expectedValue(0.25, 4)).toBeCloseTo(0);
  });
  it("implied probability = 1 / odds", () => {
    expect(impliedProbability(4)).toBeCloseTo(0.25);
  });
  it("removes the bookmaker margin when the whole field is priced", () => {
    const { probs, overround } = overroundAdjusted([2, 3, 4]);
    expect(overround).toBeCloseTo(1 / 2 + 1 / 3 + 1 / 4);
    expect(probs.reduce((a, b) => a! + b!, 0)).toBeCloseTo(1);
  });
});

describe("selection rules", () => {
  const s = { min_win_odds: 3, min_confidence: 60, min_expected_value: 0.05 };
  it("meeting the price alone does not qualify a horse", () => {
    const r = evaluateRunner({ odds: 5, oracleProb: 0.18, confidence: 80 }, s); // EV −10%
    expect(r.decision).toBe("rejected");
  });
  it("qualifies only with price, positive value and confidence all passing", () => {
    expect(evaluateRunner({ odds: 4, oracleProb: 0.3, confidence: 70 }, s).decision).toBe("qualified");
    expect(evaluateRunner({ odds: 4, oracleProb: 0.3, confidence: 50 }, s).decision).toBe("rejected");
    expect(evaluateRunner({ odds: 2.9, oracleProb: 0.6, confidence: 90 }, s).decision).toBe("rejected");
  });
  it("never qualifies without a tested probability", () => {
    const r = evaluateRunner({ odds: 8, oracleProb: null, confidence: 90 }, s);
    expect(r.decision).toBe("rejected");
    expect(r.reasons.join(" ")).toMatch(/No tested Oracle win probability/);
  });
  it("a short-priced top pick is rejected while another runner can still qualify", () => {
    const fav = evaluateRunner({ odds: 2.2, oracleProb: 0.5, confidence: 90 }, s);
    const other = evaluateRunner({ odds: 6, oracleProb: 0.22, confidence: 70 }, s);
    expect(fav.decision).toBe("rejected");
    expect(other.decision).toBe("qualified");
  });
});

describe("daily status", () => {
  it("a data failure is never reported as 'no matching winners'", () => {
    expect(reportStatus({ eligibleRaces: 0, fullyAnalysedRaces: 0, qualifying: 0, dataProblems: 1 })).toBe("data_unavailable");
    expect(reportStatus({ eligibleRaces: 10, fullyAnalysedRaces: 8, qualifying: 0, dataProblems: 0 })).toBe("data_unavailable");
  });
  it("'no matching winners' only after every eligible race was fully analysed", () => {
    expect(reportStatus({ eligibleRaces: 10, fullyAnalysedRaces: 10, qualifying: 0, dataProblems: 0 })).toBe("no_winners");
    expect(reportStatus({ eligibleRaces: 10, fullyAnalysedRaces: 10, qualifying: 2, dataProblems: 0 })).toBe("qualifying");
  });
});

describe("broadcasts and parade times", () => {
  it("estimated parade times are labelled as estimates", () => {
    const p = paradeTime("2026-11-21T04:00:00Z", null, 15);
    expect(p.official).toBe(false);
    expect(p.at).toBe("2026-11-21T03:45:00.000Z");
    expect(paradeTime("2026-11-21T04:00:00Z", "2026-11-21T03:50:00Z", 15).official).toBe(true);
  });
  it("replays and unconfirmed coverage never count as broadcast races", () => {
    expect(broadcastCounts("confirmed_live")).toBe(true);
    expect(broadcastCounts("scheduled")).toBe(true);
    expect(broadcastCounts("replay")).toBe(false);
    expect(broadcastCounts("unconfirmed")).toBe(false);
    expect(normaliseBroadcastStatus("")).toBe("unconfirmed");
  });
  it("only thoroughbred racing is accepted", () => {
    expect(isThoroughbred("Thoroughbred")).toBe(true);
    expect(isThoroughbred("Greyhound")).toBe(false);
    expect(isThoroughbred("Harness")).toBe(false);
  });
  it("reads race lists like 1-3,6", () => {
    expect(parseRaceList("1-3,6")).toEqual([1, 2, 3, 6]);
  });
  it("uses the local racing day, not UTC", () => {
    expect(localDate("Australia/Sydney", new Date("2026-11-20T14:30:00Z"))).toBe("2026-11-21");
  });
});

describe("$1 flat-bet back-test", () => {
  it("works out strike rate, profit, ROI and maximum drawdown", () => {
    const s = flatBetStats([
      { decided_at: "2026-01-01", odds: 4, won: false },
      { decided_at: "2026-01-02", odds: 5, won: false },
      { decided_at: "2026-01-03", odds: 3, won: true },
      { decided_at: "2026-01-04", odds: 6, won: false },
    ]);
    expect(s.selections).toBe(4);
    expect(s.winners).toBe(1);
    expect(s.strikeRate).toBe(0.25);
    expect(s.returns).toBe(3);
    expect(s.netProfit).toBe(-1);
    expect(s.roi).toBe(-0.25);
    expect(s.maxDrawdown).toBe(2);
    expect(s.averageOdds).toBe(4.5);
  });
  it("takes betting deductions from winnings", () => {
    expect(flatBetStats([{ decided_at: "a", odds: 3, won: true }], 10).returns).toBe(2.8);
  });
});

import { localClock, canonicalVenue, australianZoneFor, summarisePrices } from "../../supabase/functions/_shared/racingPuntersEdge";
describe("PuntersEdge feed helpers", () => {
  it("reads race-card clock times", () => {
    expect(localClock("2:55PM")).toBe("14:55");
    expect(localClock("12:10PM")).toBe("12:10");
    expect(localClock("12:05AM")).toBe("00:05");
  });
  it("matches venue names to stored racecourses", () => {
    expect(canonicalVenue("randwick")).toBe("Royal Randwick");
    expect(canonicalVenue("mornington")).toBe("Mornington");
  });
  it("works out the venue's time zone from the start time (Queensland has no daylight saving)", () => {
    expect(australianZoneFor("2026-11-19T03:55:00Z", "14:55")).toBe("Australia/Sydney");
    expect(australianZoneFor("2026-11-19T02:55:00Z", "12:55")).toBe("Australia/Brisbane");
    expect(australianZoneFor("2026-11-19T06:00:00Z", "14:00")).toBe("Australia/Perth");
  });
  it("uses the best fresh price and ignores stale bookmakers", () => {
    const s = summarisePrices([{ key: "a", win_price: 3.2 }, { key: "b", win_price: 3.6 }, { key: "c", win_price: 9, stale: true }]);
    expect(s.best).toBe(3.6); expect(s.bestBook).toBe("b"); expect(s.books).toBe(2); expect(s.median).toBe(3.4);
  });
});
