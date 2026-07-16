import { describe, it, expect } from "vitest";
import { decideApiKeyReminder, TRIAL_DAYS } from "./apiKeyReminderLogic";

const daysAgoIso = (days: number, now = Date.now()) =>
  new Date(now - days * 86_400_000).toISOString();

const base = {
  isOwner: false,
  hasUnlimitedAi: false,
  hasActiveReward: false,
  hasOpenAI: false,
  hasGemini: false,
};

describe("decideApiKeyReminder", () => {
  it("does not show without a created_at", () => {
    expect(decideApiKeyReminder({ ...base, createdAtIso: null }).show).toBe(false);
  });

  it("does not show for site owner / admin", () => {
    const r = decideApiKeyReminder({
      ...base,
      isOwner: true,
      createdAtIso: daysAgoIso(30),
    });
    expect(r.show).toBe(false);
    if (r.show === false) expect(r.reason).toBe("not_trial_user");
  });

  it("does not show for users with unlimited AI", () => {
    const r = decideApiKeyReminder({
      ...base,
      hasUnlimitedAi: true,
      createdAtIso: daysAgoIso(30),
    });
    expect(r.show).toBe(false);
  });

  it("does not show for users with an active reward grant", () => {
    const r = decideApiKeyReminder({
      ...base,
      hasActiveReward: true,
      createdAtIso: daysAgoIso(30),
    });
    expect(r.show).toBe(false);
  });

  it("does not show when both keys are already set", () => {
    const r = decideApiKeyReminder({
      ...base,
      hasOpenAI: true,
      hasGemini: true,
      createdAtIso: daysAgoIso(6),
    });
    expect(r.show).toBe(false);
    if (r.show === false) expect(r.reason).toBe("keys_present");
  });

  it("does not show earlier than the final 3 trial days", () => {
    const r = decideApiKeyReminder({ ...base, createdAtIso: daysAgoIso(1) });
    expect(r.show).toBe(false);
    if (r.show === false) expect(r.reason).toBe("still_early");
  });

  it("shows non-urgent reminder at day 5 (2 days left)", () => {
    const r = decideApiKeyReminder({ ...base, createdAtIso: daysAgoIso(5) });
    expect(r.show).toBe(true);
    if (r.show) {
      expect(r.daysLeft).toBe(2);
      expect(r.urgent).toBe(false);
      expect(r.missingProvider).toBe("both");
      expect(r.targetProvider).toBe("openai");
    }
  });

  it("marks reminder urgent in the final day", () => {
    const r = decideApiKeyReminder({ ...base, createdAtIso: daysAgoIso(TRIAL_DAYS) });
    expect(r.show).toBe(true);
    if (r.show) {
      expect(r.daysLeft).toBe(0);
      expect(r.urgent).toBe(true);
    }
  });

  it("targets gemini when only openai is set", () => {
    const r = decideApiKeyReminder({
      ...base,
      hasOpenAI: true,
      createdAtIso: daysAgoIso(6),
    });
    expect(r.show).toBe(true);
    if (r.show) {
      expect(r.missingProvider).toBe("gemini");
      expect(r.targetProvider).toBe("gemini");
    }
  });

  it("targets openai when only gemini is set", () => {
    const r = decideApiKeyReminder({
      ...base,
      hasGemini: true,
      createdAtIso: daysAgoIso(6),
    });
    expect(r.show).toBe(true);
    if (r.show) {
      expect(r.missingProvider).toBe("openai");
      expect(r.targetProvider).toBe("openai");
    }
  });
});
