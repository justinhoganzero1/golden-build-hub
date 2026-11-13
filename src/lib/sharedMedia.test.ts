import { describe, expect, it } from "vitest";
import { fileMimeType, isShareableMediaSource, watchPageUrl } from "./sharedMedia";

const storage = "https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/sign/movies/u/generated/a.mp4?token=abc";
const asset = "https://oraclelunar.com/__l5e/assets-v1/caf8061a/oracle-lunar-funny-cut.mp4";

describe("shared media", () => {
  it("shares videos as an oraclelunar.com watch page, not a raw file link", () => {
    const link = watchPageUrl(storage, "My clip", "video")!;
    const u = new URL(link);
    expect(u.origin).toBe("https://oraclelunar.com");
    expect(u.pathname).toBe("/watch");
    expect(u.searchParams.get("src")).toBe(storage);
    expect(u.searchParams.get("type")).toBe("video");
    expect(watchPageUrl(asset, "Funny ad", "video")).toContain("/watch?");
  });
  it("only plays our own storage and asset links", () => {
    expect(isShareableMediaSource(storage)).toBe(true);
    expect(isShareableMediaSource(asset)).toBe(true);
    expect(isShareableMediaSource("https://evil.example.com/a.mp4")).toBe(false);
    expect(isShareableMediaSource("http://oraclelunar.com/__l5e/assets-v1/a.mp4")).toBe(false);
    expect(isShareableMediaSource("data:video/mp4;base64,AAAA")).toBe(false);
    expect(watchPageUrl("https://evil.example.com/a.mp4", "x", "video")).toBeNull();
  });
  it("keeps text items on a normal link", () => {
    expect(watchPageUrl(storage, "Notes", "text")).toBeNull();
  });
  it("sends videos stored as octet-stream as real mp4 files", () => {
    expect(fileMimeType("clip.mp4", "application/octet-stream")).toBe("video/mp4");
    expect(fileMimeType("clip.mp4", "")).toBe("video/mp4");
    expect(fileMimeType("song.mp3", null)).toBe("audio/mpeg");
    expect(fileMimeType("clip.mp4", "video/webm")).toBe("video/webm");
  });
});
