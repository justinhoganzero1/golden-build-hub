import { describe, it, expect } from "vitest";
import { embedUrlFor, isClipPreviewOpen, toggleClipPreview } from "./youtubeClipPreview";

const VID = "dQw4w9WgXcQ";
const WATCH = `https://www.youtube.com/watch?v=${VID}`;
const EMBED = `https://www.youtube.com/embed/${VID}`;

describe("youtubeClipPreview", () => {
  it("builds the embed URL from a video id", () => {
    expect(embedUrlFor(VID, WATCH)).toBe(EMBED);
  });

  it("falls back to the watch URL when videoId is missing", () => {
    expect(embedUrlFor(null, WATCH)).toBe(WATCH);
  });

  it("recognises the currently-open clip by embed URL", () => {
    expect(isClipPreviewOpen(EMBED, VID)).toBe(true);
  });

  it("treats nothing open when previewUrl is null", () => {
    expect(isClipPreviewOpen(null, VID)).toBe(false);
  });

  it("treats nothing open when videoId is null", () => {
    expect(isClipPreviewOpen(EMBED, null)).toBe(false);
  });

  it("Hide collapses the iframe (regression: comparing embed to watch URL)", () => {
    // Bug shape: previously the toggle compared the embed URL to the original
    // watch URL, so the second click never returned null. Verify the fix.
    const result = toggleClipPreview(EMBED, VID, WATCH);
    expect(result.next).toBeNull();
    expect(result.opened).toBe(false);
  });

  it("opens the preview when nothing is currently showing", () => {
    const result = toggleClipPreview(null, VID, WATCH);
    expect(result.next).toBe(EMBED);
    expect(result.opened).toBe(true);
  });

  it("switching from clip A to clip B opens B", () => {
    const otherId = "abcdefghijk";
    const result = toggleClipPreview(EMBED, otherId, `https://www.youtube.com/watch?v=${otherId}`);
    expect(result.opened).toBe(true);
    expect(result.next).toBe(`https://www.youtube.com/embed/${otherId}`);
  });
});
