import { describe, expect, it } from "vitest";
import { BURP_MIN_GAP, FART_MAX_PER_VISIT, FART_MIN_GAP, HICCUP_SORRY, OPENING_MS, embarrassedLine, planMidReplyBreaths, wantsNervousGiggle, freshSoundState, humanSoundUrl, nextSoundState, pickHumanSound } from "./oracleHumanSounds";

const on = { human: true, cheeky: true };
const always = () => 0; // forces every chance to "yes"

describe("Oracle human sounds", () => {
  it("never makes any sound when human sounds are switched off", () => {
    expect(pickHumanSound("haha that's great", { ...freshSoundState(), replies: 50 }, { human: false, cheeky: true }, null, always)).toBeNull();
  });

  const never = () => 0.99; // forces every chance to "no"
  const after = (st: ReturnType<typeof freshSoundState>, kind: Parameters<typeof nextSoundState>[1], t: number) => nextSoundState(st, kind, t);

  it("burps on her 2nd reply and farts two replies later, well inside the first two minutes", () => {
    let st = freshSoundState(() => 0.99); const t0 = 1_000_000; const kinds: (string | null)[] = [];
    for (let i = 0; i < 4; i++) { const now = t0 + i * 20_000; const k = pickHumanSound("Sure!", st, on, null, never, now); kinds.push(k); st = after(st, k, now); }
    expect(kinds[0]).not.toBe("burp");
    expect(kinds[1]).toBe("burp");
    expect(kinds[2]).not.toBe("fart");
    expect(kinds[3]).toBe("fart");
    expect(60_000).toBeLessThan(OPENING_MS);
  });

  it("hurries the opening fart once 75 seconds have passed", () => {
    const st = { ...freshSoundState(), replies: 2, lastBurp: 1, startedAt: 0 };
    expect(pickHumanSound("Sure!", st, on, null, never, 80_000)).toBe("fart");
  });

  it("never burps on her very first reply", () => {
    expect(pickHumanSound("Sure!", freshSoundState(), on, null, always, 0)).not.toBe("burp");
  });

  it("spreads burps and farts out after the opening", () => {
    const st = { ...freshSoundState(), replies: 5, lastBurp: 1, lastFart: 3, fartsThisSession: 1, startedAt: 0, hiccupped: true };
    const k = pickHumanSound("Sure!", st, on, null, always, 60_000);
    expect(k === "burp" || k === "fart").toBe(false);
  });

  it("hiccups exactly once per visit and says sorry for the AI hiccups", () => {
    const st = { ...freshSoundState(), replies: 7, hiccupAt: 7, lastBurp: 1, lastFart: 3, fartsThisSession: 1, startedAt: 0 };
    expect(pickHumanSound("Sure!", st, on, null, never, 90_000)).toBe("hiccup");
    expect(embarrassedLine("hiccup")).toBe(HICCUP_SORRY);
    expect(HICCUP_SORRY).toBe("Sorry, I got the AI hiccups.");
    const done = nextSoundState(st, "hiccup", 90_000);
    expect(pickHumanSound("Sure!", { ...done, replies: 20 }, on, null, never, 200_000)).not.toBe("hiccup");
  });

  it("human and cheeky sounds are on by default", async () => {
    const { DEFAULT_PREFS } = await import("./oracleHumanSounds");
    expect(DEFAULT_PREFS).toEqual({ human: true, cheeky: true });
  });

  it("farts at most twice per visit", () => {
    expect(FART_MAX_PER_VISIT).toBe(2);
    const s = { ...freshSoundState(), replies: 200, lastBurp: 199, fartsThisSession: 2 };
    expect(pickHumanSound("Sure!", s, on, null, always)).not.toBe("fart");
  });

  it("keeps farts at least 2000 replies apart after the opening", () => {
    expect(FART_MIN_GAP).toBe(2000);
    const s = { ...freshSoundState(), replies: 2000, lastBurp: 1999, lastFart: 1, fartsThisSession: 1 };
    expect(pickHumanSound("Sure!", s, on, null, always)).not.toBe("fart");
  });

  it("keeps burps at least 2000 replies apart after the opening", () => {
    expect(BURP_MIN_GAP).toBe(2000);
    const s = { ...freshSoundState(), replies: 2000, lastBurp: 1, fartsThisSession: 2 };
    expect(pickHumanSound("Sure!", s, on, null, always)).not.toBe("burp");
  });

  it("no burps or farts when cheeky sounds are off", () => {
    const s = { ...freshSoundState(), replies: 200 };
    const k = pickHumanSound("Sure!", s, { human: true, cheeky: false }, null, always);
    expect(k === "burp" || k === "fart").toBe(false);
  });

  it("no cheeky noises or giggles when the user is sad, and silence in a crisis", () => {
    const s = { ...freshSoundState(), replies: 200 };
    for (const mood of ["sad", "anxious", "angry", "lonely"] as const) {
      const k = pickHumanSound("haha", s, on, mood, always);
      expect(["burp", "fart", "laugh"]).not.toContain(k);
    }
    expect(pickHumanSound("Please call 000", s, on, "crisis", always)).toBeNull();
  });

  it("always apologises after a fart", () => {
    expect(embarrassedLine("fart", () => 0.99)).toBeTruthy();
  });

  it("counts farts this visit", () => {
    expect(nextSoundState({ ...freshSoundState(), replies: 90 }, "fart").fartsThisSession).toBe(1);
  });

  it("breathes between sentences, never before the first and never two sentences in a row", () => {
    const at = planMidReplyBreaths(8, on, null, always);
    expect(at.has(0)).toBe(false);
    expect([...at]).toEqual([2, 4, 6]);
  });

  it("no mid-reply breaths in a crisis or with human sounds off", () => {
    expect(planMidReplyBreaths(8, on, "crisis", always).size).toBe(0);
    expect(planMidReplyBreaths(8, { human: false, cheeky: true }, null, always).size).toBe(0);
  });

  it("always gives a nervous giggle after a fart", () => {
    expect(wantsNervousGiggle("fart", () => 0.99)).toBe(true);
    expect(wantsNervousGiggle("breath", always)).toBe(false);
  });

  it("has sound clips for every look", () => {
    for (const g of ["woman", "man", "androgynous"] as const) for (const k of ["breath", "sigh", "laugh", "burp", "hiccup"] as const) expect(humanSoundUrl(k, g)).toBeTruthy();
    expect(humanSoundUrl("fart")).toBeTruthy();
  });
});
