import { describe, expect, it } from "vitest";
import { chatTrialOpen } from "../../supabase/functions/_shared/freeTrial";

describe("Oracle chat during the 7-day free trial", () => {
  const signedUpAt = "2026-11-18T00:00:00Z";

  it("is open for 7 days after sign-up without a card", () => {
    expect(chatTrialOpen({ signedUpAt, cardTrialEndsAt: null, now: new Date("2026-11-24T23:59:00Z") })).toBe(true);
  });

  it("closes once 7 days from sign-up have passed", () => {
    expect(chatTrialOpen({ signedUpAt, cardTrialEndsAt: null, now: new Date("2026-11-25T00:00:01Z") })).toBe(false);
  });

  it("stays open while a later card-checked trial is still running", () => {
    expect(chatTrialOpen({ signedUpAt, cardTrialEndsAt: "2026-11-30T00:00:00Z", now: new Date("2026-11-29T12:00:00Z") })).toBe(true);
  });
});
