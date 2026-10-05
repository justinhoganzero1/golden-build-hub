import { describe, expect, it } from "vitest";
import { buildRewriteContinuity, countStoryWords, validateRewrittenBook } from "./storyRewrite";

const words = (count: number) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");

describe("story rewrite safeguards", () => {
  it("counts words and keeps continuity context bounded", () => {
    expect(countStoryWords(" one   two\nthree ")).toBe(3);
    expect(buildRewriteContinuity([{ title: "Chapter 1", content: words(4000) }]).length).toBeLessThanOrEqual(14_000);
  });

  it("rejects incomplete and oversized replacements", () => {
    const original = [
      { title: "Chapter 1", content: words(2000) },
      { title: "Chapter 2", content: words(2000) },
    ];
    const errors = validateRewrittenBook(original, [
      { title: "Chapter 1", content: words(4001) },
    ]);
    expect(errors.some((error) => error.includes("Expected 2 chapters"))).toBe(true);
    expect(errors.some((error) => error.includes("exceeds 4,000"))).toBe(true);
  });

  it("accepts a complete book within the requested range", () => {
    const original = [
      { title: "Chapter 1", content: words(1800) },
      { title: "Chapter 2", content: words(1900) },
    ];
    expect(validateRewrittenBook(original, original)).toEqual([]);
  });
});