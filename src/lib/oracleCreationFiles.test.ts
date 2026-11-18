import { describe, it, expect, beforeEach } from "vitest";
import { creationFileName, rememberPendingVideo, listPendingVideos, forgetPendingVideo } from "./oracleCreationFiles";

describe("Oracle creations saved to the Library", () => {
  beforeEach(() => localStorage.clear());

  it("gives stored files safe, readable names", () => {
    expect(creationFileName("Music: Chill beach vibes!", "mp3")).toBe("music-chill-beach-vibes.mp3");
    expect(creationFileName("", "mp3")).toBe("creation.mp3");
  });

  it("remembers unfinished videos per account so they can be finished later", () => {
    rememberPendingVideo("user-a", "job-1", "sunset over the bay");
    expect(listPendingVideos("user-a").map(p => p.jobId)).toEqual(["job-1"]);
    expect(listPendingVideos("user-b")).toEqual([]);
    forgetPendingVideo("user-a", "job-1");
    expect(listPendingVideos("user-a")).toEqual([]);
  });

  it("drops unfinished videos older than a week", () => {
    localStorage.setItem("oracle-lunar:pending-videos:user-a", JSON.stringify([{ jobId: "old", prompt: "x", at: Date.now() - 8 * 86400_000 }]));
    expect(listPendingVideos("user-a")).toEqual([]);
  });
});
