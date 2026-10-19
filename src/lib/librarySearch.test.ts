import { describe, expect, it } from "vitest";
import { matchesLibrarySearch } from "./librarySearch";
describe("Library search", () => {
  it("finds Worker Assist using Work Cover", () => {
    expect(matchesLibrarySearch("Worker_Assist_Reimagined_v4.html", "work cover", "workcover-proposal")).toBe(true);
    expect(matchesLibrarySearch("Zero Protocol", "work cover", "story-writer")).toBe(false);
  });
});