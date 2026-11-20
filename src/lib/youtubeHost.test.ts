import { describe, it, expect } from "vitest";
import { canvasSizeFor, hostBox, splitSentences, timeSentences, slideBeats, pickRecorderType } from "./youtubeHost";

describe("youtubeHost", () => {
  it("uses widescreen for YouTube and vertical for Shorts", () => {
    expect(canvasSizeFor("youtube")).toEqual({ width: 1280, height: 720 });
    expect(canvasSizeFor("shorts")).toEqual({ width: 720, height: 1280 });
  });
  it("keeps the corner host inside the frame", () => {
    for (const f of ["youtube", "shorts"] as const) {
      const b = hostBox(f, "corner"); const s = canvasSizeFor(f);
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(s.width); expect(b.y + b.h).toBeLessThanOrEqual(s.height);
    }
  });
  it("captions cover the whole narration in order", () => {
    const lines = timeSentences(splitSentences("Hello there. This is a longer second sentence! Bye?"), 10);
    expect(lines).toHaveLength(3);
    expect(lines[0].start).toBe(0);
    expect(lines[2].end).toBeCloseTo(10);
    expect(lines[1].end - lines[1].start).toBeGreaterThan(lines[0].end - lines[0].start);
  });
  it("makes at most six short slide headlines", () => {
    const beats = slideBeats(Array.from({ length: 9 }, (_, i) => `Point number ${i}. More words.`).join("\n"));
    expect(beats).toHaveLength(6);
    expect(beats[0]).toBe("Point number 0");
  });
  it("prefers mp4 recording, falls back to webm", () => {
    expect(pickRecorderType((t) => t.startsWith("video/mp4"))?.ext).toBe("mp4");
    expect(pickRecorderType((t) => t === "video/webm")?.ext).toBe("webm");
    expect(pickRecorderType(() => false)).toBeNull();
  });
});
