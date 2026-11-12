import { describe, it, expect } from "vitest";
import { talkingPose, TALKING_LIMITS } from "./talkingMotion";
describe("talking sway", () => {
  it("stays gentle and always covers the frame edges", () => {
    for (let t = 0; t < 60; t += 0.05) {
      const p = talkingPose(t);
      expect(Math.abs(p.rotate)).toBeLessThanOrEqual(TALKING_LIMITS.rotate);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(TALKING_LIMITS.x);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(TALKING_LIMITS.y);
      expect(p.scale).toBeGreaterThan(1.06);
    }
  });
  it("actually moves over time", () => { expect(talkingPose(0.3)).not.toEqual(talkingPose(1.7)); });
});
