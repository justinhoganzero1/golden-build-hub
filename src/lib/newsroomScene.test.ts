import { describe, expect, it } from "vitest";
import { cameraAt, planShots, shotRect, SCREEN_RECT, MIN_SHOT_SECONDS } from "./newsroomScene";
import { quoteLipsync, mp4DurationSeconds, ownsPath } from "../../supabase/functions/_shared/lipsyncPricing";

const lines = Array.from({ length: 8 }, (_, i) => ({ text: `Line ${i}.`, start: i * 4, end: i * 4 + 4 }));

describe("newsroom camera", () => {
  it("opens wide, visits the wall screen, and signs off wide", () => {
    const segs = planShots(lines, 4);
    expect(segs[0].shot).toBe("wide");
    expect(segs.some((s) => s.shot === "screen")).toBe(true);
    expect(segs[segs.length - 1].shot).toBe("wide");
  });

  it("never holds a shot shorter than the minimum", () => {
    const quick = Array.from({ length: 10 }, (_, i) => ({ text: "x", start: i, end: i + 1 }));
    const segs = planShots(quick, 3);
    segs.slice(0, -1).forEach((s) => expect(s.end - s.start).toBeGreaterThanOrEqual(MIN_SHOT_SECONDS));
  });

  it("the screen shot frames the whole wall screen", () => {
    const r = shotRect("screen", "youtube");
    expect(r.x).toBeLessThanOrEqual(SCREEN_RECT.x);
    expect(r.x + r.w).toBeGreaterThanOrEqual(SCREEN_RECT.x + SCREEN_RECT.w);
    expect(r.y + r.h).toBeGreaterThanOrEqual(SCREEN_RECT.y + SCREEN_RECT.h);
  });

  it("zooms smoothly from the previous shot instead of cutting", () => {
    const segs = planShots(lines, 4);
    const second = segs[1];
    const startCam = cameraAt(segs, second.start + 0.01, "youtube");
    expect(startCam.w).toBeGreaterThan(shotRect(second.shot, "youtube").w);
  });
});

describe("lip-sync price", () => {
  it("charges US$0.025 per second at 720p converted to AUD, plus 20%", () => {
    // 10 s × US$0.025 × 1.5 = A$0.375 → 38¢ provider, 8¢ margin
    const q = quoteLipsync(10, "720p", 1.5);
    expect(q.provider_cost_cents).toBe(38);
    expect(q.platform_fee_cents).toBe(8);
    expect(q.total_cents).toBe(46);
  });

  it("charges US$0.045 per second at 1080p", () => {
    const q = quoteLipsync(20, "1080p", 1.5); // 20 × 0.045 × 1.5 = A$1.35
    expect(q.provider_cost_cents).toBe(135);
    expect(q.total_cents).toBe(135 + 27);
  });

  it("reads the clip length from an MP4 header", () => {
    const b = new Uint8Array(40);
    b.set([0x6d, 0x76, 0x68, 0x64], 4); // "mvhd"
    const dv = new DataView(b.buffer);
    dv.setUint32(8 + 12, 1000); // timescale
    dv.setUint32(8 + 16, 12500); // duration
    expect(mp4DurationSeconds(b)).toBe(12.5);
  });

  it("only accepts files from the member's own folder", () => {
    expect(ownsPath("u1", "u1/library/oracle/a.mp3")).toBe(true);
    expect(ownsPath("u1", "u2/library/oracle/a.mp3")).toBe(false);
    expect(ownsPath("u1", "u1/../u2/a.mp3")).toBe(false);
  });
});
