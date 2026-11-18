import { describe, expect, it } from "vitest";
import { BURP_MIN_GAP, FART_MAX_PER_VISIT, FART_MIN_GAP, FART_MIN_REPLIES, embarrassedLine, planMidReplyBreaths, wantsNervousGiggle, freshSoundState, humanSoundUrl, nextSoundState, pickHumanSound } from "./oracleHumanSounds";

const on = { human: true, cheeky: true };
const always = () => 0; // forces every chance to "yes"

describe("Oracle human sounds", () => {
  it("never makes any sound when human sounds are switched off", () => {
    expect(pickHumanSound("haha that's great", { ...freshSoundState(), replies: 50 }, { human: false, cheeky: true }, null, always)).toBeNull();
  });

  it("never farts in the first 6 replies", () => {
    const s = { ...freshSoundState(), replies: FART_MIN_REPLIES - 1 };
    expect(pickHumanSound("Sure!", s, on, null, always)).not.toBe("fart");
  });

  it("farts at most twice per visit", () => {
    expect(FART_MAX_PER_VISIT).toBe(2);
    const s = { ...freshSoundState(), replies: 200, fartsThisSession: 2 };
    expect(pickHumanSound("Sure!", s, on, null, always)).not.toBe("fart");
  });

  it("keeps farts at least 25 replies apart", () => {
    expect(FART_MIN_GAP).toBe(25);
    const s = { ...freshSoundState(), replies: 40, lastFart: 40 - FART_MIN_GAP + 1, fartsThisSession: 1 };
    expect(pickHumanSound("Sure!", s, on, null, always)).not.toBe("fart");
  });

  it("keeps burps at least 8 replies apart", () => {
    expect(BURP_MIN_GAP).toBe(8);
    const s = { ...freshSoundState(), replies: 30, lastBurp: 30 - BURP_MIN_GAP + 1, fartsThisSession: 2 };
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
    for (const g of ["woman", "man", "androgynous"] as const) for (const k of ["breath", "sigh", "laugh", "burp"] as const) expect(humanSoundUrl(k, g)).toBeTruthy();
    expect(humanSoundUrl("fart")).toBeTruthy();
  });
});
