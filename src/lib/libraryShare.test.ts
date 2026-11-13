import { describe, expect, it } from "vitest";
import { inlineShareBlob, libraryShareFileName, storyShareLink } from "./libraryShare";

describe("libraryShareFileName", () => {
  it("names apps as .html so phones open them in a browser", () => {
    expect(libraryShareFileName({ title: "My Game", media_type: "app", url: "<!DOCTYPE html><html></html>" })).toBe("My-Game.html");
  });
  it("names text notes as .txt", () => {
    expect(libraryShareFileName({ title: "Chat note", media_type: "text", url: "hello there" })).toBe("Chat-note.txt");
  });
  it("keeps the real extension from storage files", () => {
    expect(
      libraryShareFileName({ title: "Clip", media_type: "video", url: "https://x.supabase.co/storage/v1/object/sign/movies/u/clip.mp4?token=abc" }),
    ).toBe("Clip.mp4");
  });
});

describe("storyShareLink", () => {
  it("shares the public story page on oraclelunar.com", () => {
    expect(storyShareLink({ media_type: "story", url: "oracle-lunar://story/scam-the-scammer-20ch" })).toBe(
      "https://oraclelunar.com/stories/scam-the-scammer-20ch",
    );
  });
  it("returns null for non-story items", () => {
    expect(storyShareLink({ media_type: "video", url: "https://x" })).toBeNull();
  });
});

describe("inlineShareBlob", () => {
  it("wraps raw HTML apps as text/html", () => {
    const html = "<!DOCTYPE html><html><body>hi</body></html>";
    const blob = inlineShareBlob({ media_type: "app", url: html });
    expect(blob?.type).toBe("text/html");
    expect(blob?.size).toBe(html.length);
  });
  it("wraps text notes as text/plain", () => {
    const blob = inlineShareBlob({ media_type: "text", url: "a note" });
    expect(blob?.type).toBe("text/plain");
    expect(blob?.size).toBe(6);
  });
  it("decodes base64 data links", () => {
    const blob = inlineShareBlob({ media_type: "document", url: `data:text/markdown;base64,${btoa("# Hi")}` });
    expect(blob?.type).toBe("text/markdown");
    expect(blob?.size).toBe(4);
  });
  it("returns null for plain https files (they are signed, not re-uploaded)", () => {
    expect(inlineShareBlob({ media_type: "video", url: "https://x.supabase.co/storage/v1/object/sign/movies/a.mp4?token=t" })).toBeNull();
  });
});
