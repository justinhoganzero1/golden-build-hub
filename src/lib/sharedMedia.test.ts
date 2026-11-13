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
  it("opens apps, notes and documents on the watch page as documents", () => {
    for (const t of ["app", "text", "document"]) {
      const link = watchPageUrl(storage, "Notes", t);
      expect(link).toContain("/watch?");
      expect(new URL(link!).searchParams.get("type")).toBe("doc");
    }
  });
  it("keeps stories and unknown types on a normal link", () => {
    expect(watchPageUrl(storage, "My story", "story")).toBeNull();
  });
  it("sends videos stored as octet-stream as real mp4 files", () => {
    expect(fileMimeType("clip.mp4", "application/octet-stream")).toBe("video/mp4");
    expect(fileMimeType("clip.mp4", "")).toBe("video/mp4");
    expect(fileMimeType("song.mp3", null)).toBe("audio/mpeg");
    expect(fileMimeType("clip.mp4", "video/webm")).toBe("video/webm");
  });
  it("trusts the file extension over the plain-text label signed links serve", () => {
    expect(fileMimeType("my-game.html", "text/plain")).toBe("text/html");
    expect(fileMimeType("note.txt", "text/plain")).toBe("text/plain");
    expect(fileMimeType("clip.mp4", "text/plain; charset=utf-8")).toBe("video/mp4");
  });
});
