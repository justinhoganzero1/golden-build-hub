import { describe, expect, it } from "vitest";
import { geminiSetupNeeded } from "./geminiSetupGate";

describe("Google key setup is forced after sign-up", () => {
  it("sends members without a connected key to the key setup", () => {
    expect(geminiSetupNeeded({ isOwner: false, path: "/oracle", verifiedAt: null })).toBe(true);
    expect(geminiSetupNeeded({ isOwner: false, path: "/media-library", verifiedAt: null })).toBe(true);
  });
  it("lets members with a connected key through", () => {
    expect(geminiSetupNeeded({ isOwner: false, path: "/oracle", verifiedAt: "2026-11-18T00:00:00Z" })).toBe(false);
  });
  it("never forces the owner", () => {
    expect(geminiSetupNeeded({ isOwner: true, path: "/oracle", verifiedAt: null })).toBe(false);
  });
  it("keeps the setup, safety help and settings open", () => {
    for (const p of ["/ai-key-setup", "/crisis-hub", "/safety-center", "/settings"]) {
      expect(geminiSetupNeeded({ isOwner: false, path: p, verifiedAt: null })).toBe(false);
    }
  });
});
