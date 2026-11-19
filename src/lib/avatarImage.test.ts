import { describe, it, expect } from "vitest";
import { needsAvatarShrink } from "./avatarImage";

describe("needsAvatarShrink", () => {
  it("shrinks big stored pictures", () => {
    expect(needsAvatarShrink("data:image/png;base64," + "A".repeat(2_000_000))).toBe(true);
  });
  it("leaves web links alone", () => {
    expect(needsAvatarShrink("https://oraclelunar.com/a.png")).toBe(false);
  });
  it("leaves small pictures and animations alone", () => {
    expect(needsAvatarShrink("data:image/png;base64,AAAA")).toBe(false);
    expect(needsAvatarShrink("data:image/gif;base64," + "A".repeat(2_000_000))).toBe(false);
  });
});
