import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, TRIAL_LIMITS, TRIAL_VIDEO_SECONDS, trialEndsAt, trialGate } from "../../supabase/functions/_shared/freeTrial";

const now = new Date("2026-11-18T00:00:00Z");

describe("free trial rules", () => {
  it("gives 3 pictures and 1 eight-second video", () => {
    expect(TRIAL_LIMITS).toEqual({ image: 3, video: 1 });
    expect(TRIAL_VIDEO_SECONDS).toBe(8);
  });

  it("lasts 7 days from the card check", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(trialEndsAt(now).toISOString()).toBe("2026-11-25T00:00:00.000Z");
  });

  it("needs a verified card before a Free member can use it", () => {
    expect(trialGate({ isOwner: false, plan: "free", trialEndsAt: null, now })).toBe("card_required");
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
