import { describe, it, expect } from "vitest";
import { oracleChatTier, tierSettings } from "./oraclePresenter";
describe("Oracle chat levels", () => {
  it("basic is free device voice with no clips", () => expect(tierSettings("basic")).toEqual({ speech: "device", video: false }));
  it("voice uses paid voice without clips", () => expect(tierSettings("voice")).toEqual({ speech: "premium", video: false }));
  it("premium turns on lip-sync clips", () => expect(tierSettings("premium")).toEqual({ speech: "premium", video: true }));
  it("clips always read as premium", () => expect(oracleChatTier("device", true)).toBe("premium"));
  it("rejects unknown levels", () => expect(tierSettings("free-video")).toBeNull());
});
