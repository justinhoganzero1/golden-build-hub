import { describe, it, expect } from "vitest";
import { productionPercent, productionStage } from "./productionStages";
describe("production progress", () => {
  it("moves through stages by time", () => {
    expect(productionStage(0)).toBe(0); expect(productionStage(30)).toBe(1); expect(productionStage(70)).toBe(2); expect(productionStage(200)).toBe(3);
  });
  it("never claims 100% before the video arrives", () => { expect(productionPercent(10000)).toBe(95); });
});
