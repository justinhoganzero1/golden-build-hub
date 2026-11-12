import { describe, expect, it } from "vitest";
import { BURP_MIN_GAP, FART_MIN_REPLIES, embarrassedLine, freshSoundState, humanSoundUrl, nextSoundState, pickHumanSound } from "./oracleHumanSounds";

const on = { human: true, cheeky: true };
const always = () => 0; // forces every chance to "yes"

describe("Oracle human sounds", () => {
  it("never makes any sound when human sounds are switched off", () => {
    expect(pickHumanSound("haha that's great", { ...freshSoundState(), replies: 50 }, { human: false, cheeky: true }, null, always)).toBeNull();
  });

  it("never farts in the first 10 replies", () => {
    const s = { ...freshSoundState(), replies: FART_MIN_REPLIES - 1 };
    expect(pickHumanSound("Sure!", s, on, null, always)).not.toBe("fart");
  });

  it("farts at most once per visit", () => {
    const s = { ...freshSoundState(), replies: 200, fartedThisSession: true };
    expect(pickHumanSound("Sure!", s, on, null, always)).not.toBe("fart");
  });

  it("keeps burps at least 20 replies apart", () => {
    const s = { ...freshSoundState(), replies: 30, lastBurp: 30 - BURP_MIN_GAP + 1, fartedThisSession: true };
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

  it("records the fart so it cannot repeat this visit", () => {
    expect(nextSoundState({ ...freshSoundState(), replies: 90 }, "fart").fartedThisSession).toBe(true);
  });

  it("has sound clips for every look", () => {
    for (const g of ["woman", "man", "androgynous"] as const) for (const k of ["breath", "sigh", "laugh", "burp"] as const) expect(humanSoundUrl(k, g)).toBeTruthy();
    expect(humanSoundUrl("fart")).toBeTruthy();
  });
});
