import { describe, it, expect } from "vitest";
import { allFillers, allFillerClips, classifyForFiller, pickFiller } from "./oracleFillers";

describe("Oracle thinking reactions", () => {
  it("stores more than 1000 different reactions", () => {
    const texts = new Set(allFillers().map(f => f.text));
    expect(texts.size).toBeGreaterThan(1000);
  });
  it("picks a fitting kind of reaction", () => {
    expect(classifyForFiller("I'm feeling really lonely tonight")).toBe("feelings");
    expect(classifyForFiller("Write me a poem about the moon")).toBe("task");
    expect(classifyForFiller("Why is the sky blue?")).toBe("question");
    expect(classifyForFiller("What's the latest news in Brisbane")).toBe("research");
    expect(classifyForFiller("haha you're funny")).toBe("chat");
  });
  it("never repeats a recently used reaction or the same opener twice in a row", () => {
    const recent: string[] = [];
    for (let i = 0; i < 40; i++) {
      const f = pickFiller("Why is the sky blue?", recent);
      expect(recent).not.toContain(f.key);
      if (recent.length) expect(f.clips[0].id).not.toBe(recent[recent.length - 1].split("+")[0]);
      recent.push(f.key);
    }
  });
  it("sad messages only get gentle reactions", () => {
    const f = pickFiller("I feel awful and alone", [], () => 0.5);
    expect(f.category).toBe("feelings");
    expect(f.clips[0].id.startsWith("fo")).toBe(true);
  });
  it("each reaction is built from recorded clips", () => {
    const ids = new Set(allFillerClips().map(c => c.id));
    expect(ids.size).toBe(124);
    for (const f of allFillers()) for (const c of f.clips) expect(ids.has(c.id)).toBe(true);
  });
});
