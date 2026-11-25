import { describe, it, expect } from "vitest";
import { parseExerciseRequest } from "./exerciseRequest";
describe("parseExerciseRequest", () => {
  it("star jumps video", () => expect(parseExerciseRequest("show me a video of star jumps")).toBe("jumping_jack"));
  it("push ups", () => expect(parseExerciseRequest("how do I do push-ups")).toBe("pushup"));
  it("squats", () => expect(parseExerciseRequest("play the squat clip")).toBe("squat"));
  it("chat only", () => expect(parseExerciseRequest("I did squats yesterday")).toBeNull());
});
