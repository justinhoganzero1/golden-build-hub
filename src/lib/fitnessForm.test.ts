import { describe, it, expect } from "vitest";
import { angle, stepReps } from "./fitnessForm";

describe("fitness tracking", () => {
  it("measures a right angle", () => {
    expect(Math.round(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }))).toBe(90);
  });
  it("counts a squat only after going down and back up", () => {
    let s = { phase: "up" as const, reps: 0 } as { phase: "up" | "down"; reps: number };
    s = stepReps("squat", s, 170); expect(s.reps).toBe(0);
    s = stepReps("squat", s, 90); expect(s.phase).toBe("down");
    s = stepReps("squat", s, 130); expect(s.reps).toBe(0);
    s = stepReps("squat", s, 165); expect(s.reps).toBe(1);
  });
});
