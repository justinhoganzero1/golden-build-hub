import { describe, expect, it, vi } from "vitest";
import { artifactAnnouncement, finishedArtifact, resolveSpeechMode, routeOracleSpeech } from "./oraclePresenter";

describe("Oracle presenter rules", () => {
  it("defaults new users to device speech without overwriting saved premium voice", () => {
    expect(resolveSpeechMode(null, false)).toBe("device");
    expect(resolveSpeechMode(null, true)).toBe("premium");
    expect(resolveSpeechMode("device", true)).toBe("device");
  });
  it("never invokes paid speech in device mode", async () => {
    const device = vi.fn(async () => {}), paid = vi.fn(async () => {});
    await routeOracleSpeech("device", device, paid);
    expect(device).toHaveBeenCalledOnce();
    expect(paid).not.toHaveBeenCalled();
  });
  it("rejects failed, queued and fallback generation results", () => {
    const item = { id: "1", kind: "video" as const, url: "video.mp4", deepPath: "/media-library" };
    expect(finishedArtifact({ ...item, state: "failed" })).toBeNull();
    expect(finishedArtifact({ ...item, state: "queued" })).toBeNull();
    expect(finishedArtifact({ ...item, state: "complete", fallback: true })).toBeNull();
    expect(finishedArtifact({ ...item, state: "complete" })?.kind).toBe("video");
  });
  it("requires a real payload or saved record before offering a reveal", () => {
    expect(finishedArtifact({ id: "1", kind: "app", deepPath: "/app-builder?prompt=test", state: "complete" })).toBeNull();
  });
  it("keeps save confirmation and reused results separate from fresh completion", () => {
    const item = { id: "1", kind: "image" as const, url: "image.png", deepPath: "/media-library" };
    expect(artifactAnnouncement(item)).toContain("save is not confirmed");
    expect(artifactAnnouncement({ ...item, libraryId: "saved" })).toContain("saved in your Library");
    expect(artifactAnnouncement({ ...item, reused: true })).toContain("existing image");
  });
});