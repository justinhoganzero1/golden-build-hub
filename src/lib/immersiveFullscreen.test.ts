import { describe, expect, it } from "vitest";
import { shouldAutoFullscreen } from "./immersiveFullscreen";

const phone = { coarsePointer: true, inIframe: false, native: false, supported: true, displayFullscreen: false, tv: false };

describe("shouldAutoFullscreen", () => {
  it("goes full screen on a phone browser", () => {
    expect(shouldAutoFullscreen(phone)).toBe(true);
  });
  it("leaves desktop computers alone", () => {
    expect(shouldAutoFullscreen({ ...phone, coarsePointer: false })).toBe(false);
  });
  it("skips the installed app, which hides the bars itself", () => {
    expect(shouldAutoFullscreen({ ...phone, native: true })).toBe(false);
    expect(shouldAutoFullscreen({ ...phone, displayFullscreen: true })).toBe(false);
  });
  it("skips the Lovable preview frame and TVs", () => {
    expect(shouldAutoFullscreen({ ...phone, inIframe: true })).toBe(false);
    expect(shouldAutoFullscreen({ ...phone, tv: true })).toBe(false);
  });
  it("skips browsers without full screen support (iPhone Safari)", () => {
    expect(shouldAutoFullscreen({ ...phone, supported: false })).toBe(false);
  });
});
