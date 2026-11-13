import { describe, expect, it } from "vitest";
import { resolveAssetUrl } from "./assetOrigin";

const ad = "/__l5e/assets-v1/abc/oracle-lunar-funny-cut.mp4";

describe("resolveAssetUrl", () => {
  it("points built-in videos at oraclelunar.com inside the installed Android/TV app", () => {
    expect(resolveAssetUrl(ad, { protocol: "https:", hostname: "localhost" })).toBe(`https://oraclelunar.com${ad}`);
  });
  it("points built-in videos at oraclelunar.com inside the iPhone app", () => {
    expect(resolveAssetUrl(ad, { protocol: "capacitor:", hostname: "localhost" })).toBe(`https://oraclelunar.com${ad}`);
  });
  it("leaves the website and preview untouched", () => {
    expect(resolveAssetUrl(ad, { protocol: "https:", hostname: "oraclelunar.com" })).toBe(ad);
    expect(resolveAssetUrl(ad, { protocol: "http:", hostname: "localhost" })).toBe(ad);
  });
  it("never rewrites other links", () => {
    expect(resolveAssetUrl("https://x.supabase.co/a.mp4", { protocol: "https:", hostname: "localhost" })).toBe("https://x.supabase.co/a.mp4");
  });
});
