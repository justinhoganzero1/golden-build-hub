import { describe, it, expect, vi } from "vitest";
import { webShareAllowed, isShareCancel, systemShare } from "./systemShare";

describe("webShareAllowed", () => {
  it("is false when the browser has no share menu", () => {
    expect(webShareAllowed({}, {})).toBe(false);
  });
  it("is false inside a frame that blocks sharing", () => {
    expect(webShareAllowed({ share: async () => {} }, { featurePolicy: { allowsFeature: () => false, features: () => ["web-share"] } })).toBe(false);
  });
  it("ignores a browser that doesn't know the share permission at all", () => {
    expect(webShareAllowed({ share: async () => {} }, { featurePolicy: { allowsFeature: () => false, features: () => ["camera"] } })).toBe(true);
  });
  it("is true on a normal page with a share menu", () => {
    expect(webShareAllowed({ share: async () => {} }, { featurePolicy: { allowsFeature: () => true } })).toBe(true);
  });
});

describe("isShareCancel", () => {
  it("treats closing the menu as a cancel, not a failure", () => {
    expect(isShareCancel({ name: "AbortError" })).toBe(true);
    expect(isShareCancel(new Error("Share canceled"))).toBe(true);
    expect(isShareCancel({ name: "NotAllowedError" })).toBe(false);
  });
});

describe("systemShare in a browser", () => {
  it("reports unavailable instead of failing when the browser refuses", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
    vi.stubGlobal("navigator", { share });
    await expect(systemShare({ title: "Ad", url: "https://oraclelunar.com/watch" })).resolves.toBe("unavailable");
    vi.unstubAllGlobals();
  });
  it("shares the link when allowed", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    await expect(systemShare({ title: "Ad", url: "https://oraclelunar.com/watch" })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: "https://oraclelunar.com/watch" }));
    vi.unstubAllGlobals();
  });
});
