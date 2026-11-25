import { describe, it, expect } from "vitest";
import { parseExerciseRequest, parseFitnessVideoQuery } from "./exerciseRequest";
describe("parseExerciseRequest", () => {
  it("star jumps video", () => expect(parseExerciseRequest("show me a video of star jumps")).toBe("jumping_jack"));
  it("push ups", () => expect(parseExerciseRequest("how do I do push-ups")).toBe("pushup"));
  it("squats", () => expect(parseExerciseRequest("play the squat clip")).toBe("squat"));
  it("chat only", () => expect(parseExerciseRequest("I did squats yesterday")).toBeNull());
});
describe("fitness video discovery commands", () => {
  it("discovers exercises beyond the original three", () => expect(parseFitnessVideoQuery("show me a video of lunges")).toBe("lunges"));
  it("normalizes star jumps for a reusable template", () => expect(parseFitnessVideoQuery("show me a video of star jumps")).toBe("jumping jacks"));
  it("leaves ordinary chat alone", () => expect(parseFitnessVideoQuery("I did lunges yesterday")).toBeNull());
  it("does not intercept unrelated videos", () => expect(parseFitnessVideoQuery("show me a video of the moon")).toBeNull());
});
