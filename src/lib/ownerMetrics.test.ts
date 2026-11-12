import { describe, expect, it } from "vitest";
import {
  countPaidMembers,
  deviceFromUserAgent,
  isRealMoneyEnvironment,
  planLabel,
  trafficSource,
} from "../../supabase/functions/_shared/ownerMetrics";

describe("owner dashboard figures", () => {
  it("does not count a test-money (sandbox) subscription as a paid member", () => {
    expect(countPaidMembers([{ status: "active", environment: "sandbox" }], 0)).toEqual({ real: 0, test: 1 });
  });

  it("counts live subscriptions and founder seats as paid members", () => {
    const subs = [
      { status: "active", environment: "live" },
      { status: "trialing", environment: "live" },
      { status: "canceled", environment: "live" },
    ];
    expect(countPaidMembers(subs, 2)).toEqual({ real: 4, test: 0 });
  });

  it("treats only live mode as real money", () => {
    expect(isRealMoneyEnvironment("live")).toBe(true);
    expect(isRealMoneyEnvironment("sandbox")).toBe(false);
    expect(isRealMoneyEnvironment(null)).toBe(false);
  });

  it("names visitor sources like the Sources tab", () => {
    expect(trafficSource("Facebook", "https://google.com")).toBe("facebook");
    expect(trafficSource(null, "https://www.google.com/search")).toBe("google.com");
    expect(trafficSource(null, null)).toBe("direct");
  });

  it("labels devices and plans in plain words", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14)")).toBe("Android");
    expect(planLabel("plus_monthly")).toBe("Plus monthly");
    expect(planLabel("pro_yearly")).toBe("Pro yearly");
  });
});
