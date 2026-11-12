import { beforeEach, describe, expect, it } from "vitest";
import { ALWAYS_OPEN, discoveryNote, isUnlocked, loadUnlocks, modulesForText, needsGuidedUnlock, unlockEverything, unlockMarkers, unlockPaths } from "./oracleDiscovery";

describe("guided app discovery", () => {
  beforeEach(() => localStorage.clear());

  it("only new members get guided unlocks; older members and the owner see everything", () => {
    expect(needsGuidedUnlock("2026-11-13T00:00:00Z", false)).toBe(true);
    expect(needsGuidedUnlock("2026-10-01T00:00:00Z", false)).toBe(false);
    expect(needsGuidedUnlock("2026-11-13T00:00:00Z", true)).toBe(false);
  });

  it("safety pages are always open", () => {
    const fresh = loadUnlocks("u1");
    expect(ALWAYS_OPEN).toContain("/crisis-hub");
    expect(isUnlocked(fresh, "/crisis-hub")).toBe(true);
    expect(isUnlocked(fresh, "/movie-studio-pro")).toBe(false);
  });

  it("an app unlocks once when Oracle introduces it", () => {
    expect(unlockPaths("u1", ["/movie-studio-pro"]).map(m => m.label)).toEqual(["Movie Studio"]);
    expect(unlockPaths("u1", ["/movie-studio-pro"])).toEqual([]);
    expect(isUnlocked(loadUnlocks("u1"), "/movie-studio-pro")).toBe(true);
  });

  it("reads Oracle's unlock markers and the member's own words", () => {
    expect(unlockMarkers("Try this!\n[[UNLOCK:/story-writer]]")).toEqual(["/story-writer"]);
    expect(modulesForText("I want to write a book").map(m => m.path)).toContain("/story-writer");
    expect(modulesForText("hello there")).toEqual([]);
  });

  it("show me everything unlocks all and stops the guide note", () => {
    unlockEverything("u1");
    expect(isUnlocked(loadUnlocks("u1"), "/app-builder")).toBe(true);
    expect(discoveryNote(loadUnlocks("u1"))).toBeNull();
  });
});
