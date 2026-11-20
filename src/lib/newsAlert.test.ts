import { describe, it, expect } from "vitest";
import { isNuclearLaunchHeadline, confirmedNuclearAlert, newsBriefing } from "../../supabase/functions/_shared/newsAlert";

const now = Date.parse("2026-11-21T00:00:00Z");
const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
const item = (publisher: string, title: string, minsAgo = 10, official = false) => ({ publisher, title, url: `https://${publisher}/x`, official, at: at(minsAgo) });
const real = "Russia launches nuclear missile at Ukraine";

describe("nuclear launch emergency rule", () => {
  it("recognises a real launch headline", () => {
    expect(isNuclearLaunchHeadline(real)).toBe(true);
    expect(isNuclearLaunchHeadline("Nuclear warhead detonated over Pacific, officials say")).toBe(true);
  });
  it("ignores tests, drills, threats, capable missiles, energy and history", () => {
    for (const t of [
      "North Korea test-fires nuclear-capable missile",
      "Putin threatens nuclear strike if NATO intervenes",
      "Nuclear missile drill held in Nevada",
      "Could a nuclear attack happen? Experts weigh in",
      "Nuclear power plant hit by drone strike",
      "Remembering Hiroshima: the day the atomic bomb was dropped",
      "North Korea launches ICBM into sea",
      "Unconfirmed reports of nuclear missile launch",
    ]) expect(isNuclearLaunchHeadline(t)).toBe(false);
  });
  it("needs three different outlets — one or two outlets alone never trigger it", () => {
    expect(confirmedNuclearAlert([item("bbc", real)], now)).toBeNull();
    expect(confirmedNuclearAlert([item("bbc", real), item("abc.net.au", real)], now)).toBeNull();
    expect(confirmedNuclearAlert([item("bbc", real), item("bbc", real), item("bbc", real)], now)).toBeNull();
    const a = confirmedNuclearAlert([item("bbc", real), item("abc.net.au", real), item("aljazeera.com", real)], now);
    expect(a?.sources).toHaveLength(3);
  });
  it("two outlets are enough when one is an official source", () => {
    expect(confirmedNuclearAlert([item("bbc", real), item("un.org", real, 5, true)], now)).not.toBeNull();
  });
  it("only counts reports from the last three hours", () => {
    expect(confirmedNuclearAlert([item("bbc", real, 200), item("abc.net.au", real, 200), item("aljazeera.com", real)], now)).toBeNull();
  });
});

describe("Oracle's news briefing", () => {
  it("lists confirmed stories with how confirmed they are and skips unverified ones", () => {
    const b = newsBriefing([
      { headline: "Floods hit Queensland", verification: "corroborated", source_count: 4, last_updated: at(5), is_breaking: true },
      { headline: "Rumour story", verification: "unverified", source_count: 1, last_updated: at(5) },
    ], new Date(now));
    expect(b).toContain("BREAKING: Floods hit Queensland (confirmed by several outlets, 4 outlets)");
    expect(b).not.toContain("Rumour story");
  });
  it("gives nothing when there is no news", () => {
    expect(newsBriefing([], new Date(now))).toBe("");
  });
});

describe("Oracle daily news refresh", () => {
  it("refreshes at 6am Brisbane (20:00 UTC) once a day", async () => {
    const { dailyNewsCutoff } = await import("../../supabase/functions/_shared/newsAlert");
    // 9:48am Brisbane Sat = 23:48 UTC Fri → today's 6am Brisbane = 20:00 UTC Fri
    expect(new Date(dailyNewsCutoff(Date.parse("2026-11-20T23:48:00Z"))).toISOString()).toBe("2026-11-20T20:00:00.000Z");
    // 5:59am Brisbane Sat = 19:59 UTC Fri → still yesterday's 6am
    expect(new Date(dailyNewsCutoff(Date.parse("2026-11-20T19:59:00Z"))).toISOString()).toBe("2026-11-19T20:00:00.000Z");
  });
});
