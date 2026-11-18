import { describe, it, expect } from "vitest";
import { composeIntakePrompt, intakeComplete } from "./appBuilderPurpose";
import { resolvePurpose } from "../../supabase/functions/app-builder-autonomous/purpose";

describe("App Builder: for me or to sell", () => {
  it("uses the member's choice when they made one", () => {
    expect(resolvePurpose("personal", "sell it for $4.99")).toBe("personal");
    expect(resolvePurpose("sell", "a habit tracker")).toBe("sell");
  });

  it("defaults to own use unless the request clearly talks about selling", () => {
    expect(resolvePurpose(undefined, "a habit tracker for me")).toBe("personal");
    expect(resolvePurpose(undefined, "a paid meditation app for $4.99/mo")).toBe("sell");
  });

  it("own-use requests say no prices, paywalls or store listing", () => {
    const p = composeIntakePrompt("personal", { goal: "track my workouts", who: "Just me", musts: ["Works offline", "Reminders"] });
    expect(p).toContain("for my own use");
    expect(p).toContain("track my workouts");
    expect(p).toContain("Works offline, Reminders");
    expect(p).toMatch(/No prices, paywalls/);
  });

  it("apps to sell carry the pricing and where they'll be sold", () => {
    const p = composeIntakePrompt("sell", { goal: "dog walking bookings", pricing: "Monthly subscription", where: ["Google Play"] });
    expect(p).toContain("app to sell");
    expect(p).toContain("Monthly subscription");
    expect(p).toContain("Google Play");
  });

  it("needs the main goal before building", () => {
    expect(intakeComplete("personal", {})).toBe(false);
    expect(intakeComplete("personal", { goal: "plan meals" })).toBe(true);
  });
});
