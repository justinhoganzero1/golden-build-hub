import { describe, it, expect } from "vitest";
import { frameTimes } from "./videoFrames";

describe("parade clip frame picking", () => {
  it("spreads six stills evenly through a 70 second clip, skipping the ends", () => {
    expect(frameTimes(70, 6)).toEqual([10, 20, 30, 40, 50, 60]);
  });
  it("falls back to the first moment when the length is unknown", () => {
    expect(frameTimes(NaN, 6)).toEqual([0]);
  });
});
