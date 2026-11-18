import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, TRIAL_LIMITS, TRIAL_VIDEO_SECONDS, laterEnd, trialEndsAt, trialGate } from "../../supabase/functions/_shared/freeTrial";

const now = new Date("2026-11-18T00:00:00Z");

describe("free trial rules", () => {
  it("gives 3 pictures and 1 eight-second video", () => {
    expect(TRIAL_LIMITS).toEqual({ image: 3, video: 1 });
    expect(TRIAL_VIDEO_SECONDS).toBe(8);
  });

  it("lasts 7 days from sign-up", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(trialEndsAt(now).toISOString()).toBe("2026-11-25T00:00:00.000Z");
  });

  it("never asks for a card: a Free member inside 7 days can use it", () => {
    expect(trialGate({ isOwner: false, plan: "free", trialEndsAt: trialEndsAt(now).toISOString(), now })).toBe("claim");
  });

  it("refuses a second trial for the same person on another account", () => {
    expect(trialGate({ isOwner: false, plan: "free", trialEndsAt: trialEndsAt(now).toISOString(), blocked: true, now })).toBe("duplicate");
  });

  it("uses the later end date when an older card-checked trial exists", () => {
    expect(laterEnd("2026-11-20T00:00:00.000Z", "2026-11-25T00:00:00.000Z")).toBe("2026-11-25T00:00:00.000Z");
    expect(laterEnd("2026-11-20T00:00:00.000Z", null)).toBe("2026-11-20T00:00:00.000Z");
  });

  it("is open inside the 7 days and closed after", () => {
    const ends = trialEndsAt(now).toISOString();
    expect(trialGate({ isOwner: false, plan: "free", trialEndsAt: ends, now: new Date("2026-11-24T23:59:00Z") })).toBe("claim");
    expect(trialGate({ isOwner: false, plan: "free", trialEndsAt: ends, now: new Date("2026-11-25T00:00:01Z") })).toBe("expired");
  });

  it("never applies to paid plans or the owner", () => {
    expect(trialGate({ isOwner: false, plan: "plus", trialEndsAt: null, now })).toBe("paid");
    expect(trialGate({ isOwner: true, plan: "free", trialEndsAt: null, now })).toBe("paid");
  });
});
