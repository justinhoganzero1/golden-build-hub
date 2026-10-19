import { describe, expect, it } from "vitest";
import { markupCents, PLATFORM_MARKUP_PCT } from "../../supabase/functions/_shared/pricing";

describe("mandatory provider cost plus 20 percent", () => {
  it("adds exactly 20 cents to a 100-cent provider cost", () => {
    expect(PLATFORM_MARKUP_PCT).toBe(0.20);
    expect(markupCents(100)).toEqual({ provider_cost_cents: 100, platform_fee_cents: 20, total_cents: 120 });
  });
  it("rounds the 20 percent fee upward rather than undercharging", () => {
    expect(markupCents(101)).toEqual({ provider_cost_cents: 101, platform_fee_cents: 21, total_cents: 122 });
  });
});