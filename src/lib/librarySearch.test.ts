import { describe, expect, it } from "vitest";
import { keepNewestVersions, matchesLibrarySearch } from "./librarySearch";
describe("Library search", () => {
  it("finds Worker Assist using Work Cover", () => {
    expect(matchesLibrarySearch("Worker_Assist_Reimagined_v4.html", "work cover", "workcover-proposal")).toBe(true);
    expect(matchesLibrarySearch("Zero Protocol", "work cover", "story-writer")).toBe(false);
  });
  it("shows only the newest version of each app", () => {
    const out = keepNewestVersions([
      { title: "Worker_Assist_Reimagined_v3.html", media_type: "app", created_at: "2026-10-01" },
      { title: "Worker_Assist_Reimagined_v4.html", media_type: "app", created_at: "2026-10-02" },
      { title: "Worker_Assist_Reimagined.html", media_type: "app", created_at: "2026-09-01" },
      { title: "Zero Protocol", media_type: "app", created_at: "2026-09-01" },
    ]);
    expect(out).toHaveLength(2);
    const wa = out.find(i => i.title!.startsWith("Worker"))!;
    expect(wa.title).toBe("Worker_Assist_Reimagined_v4.html");
    expect(wa.olderVersions).toHaveLength(2);
  });
});
