import { describe, expect, it } from "vitest";
import { addReading, currentMood, detectMood, detectShift, moodNote, type MoodReading } from "./oracleMood";

const run = (...texts: string[]) => texts.reduce<MoodReading[]>((h, t, i) => addReading(h, detectMood(t, i)), []);

describe("Oracle emotional awareness", () => {
  it("reads common moods", () => {
    expect(detectMood("I'm so stressed about my exam tomorrow").mood).toBe("anxious");
    expect(detectMood("My dog passed away this morning").mood).toBe("sad");
    expect(detectMood("I got the job!!").mood).toBe("excited");
    expect(detectMood("I feel so lonely, no one cares").mood).toBe("lonely");
    expect(detectMood("what's the weather like").mood).toBe("neutral");
  });

  it("treats 'not happy' as low, not happy", () => {
    expect(detectMood("I'm not happy at all").mood).toBe("sad");
  });

  it("always flags crisis words first, at full strength", () => {
    const r = detectMood("great day but honestly I want to die");
    expect(r.mood).toBe("crisis");
    expect(r.intensity).toBe(3);
  });

  it("spots a mood dropping during the chat", () => {
    const shift = detectShift(run("I had a great day at the beach", "love it", "actually I just got some awful news, I'm devastated"));
    expect(shift).toEqual({ from: "happy", to: "sad", direction: "dropped" });
  });

  it("spots a mood lifting during the chat", () => {
    expect(detectShift(run("I'm so worried about the results", "they came back clear, I'm so happy"))?.direction).toBe("lifted");
  });

  it("keeps the feeling through a plain follow-up message", () => {
    const h = run("I'm really sad today", "anyway what time is it");
    expect(currentMood(h)?.mood).toBe("sad");
    expect(detectShift(h)).toBeNull();
  });

  it("sends no note for neutral chat", () => {
    expect(moodNote(run("what's the capital of France"))).toBeNull();
    expect(moodNote(run("I'm happy", "I'm so stressed now"))).toContain("mood shift: dropped from happy to anxious");
  });
});
