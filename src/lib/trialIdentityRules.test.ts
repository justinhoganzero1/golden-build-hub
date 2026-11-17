import { describe, expect, it } from "vitest";
import { collectMarks, hashMark, normalizeEmail, trialUsedByOther } from "../../supabase/functions/_shared/trialIdentity";

describe("one free trial per person", () => {
  it("treats Gmail dots, +tags and capitals as the same email", () => {
    expect(normalizeEmail("Juz.Zy+trial2@GoogleMail.com")).toBe("juzzy@gmail.com");
    expect(normalizeEmail("a.b+x@example.com")).toBe("a.b@example.com");
  });

  it("blocks a new account that shares any detail with another trial account", () => {
    expect(trialUsedByOther("new", [{ user_id: "old", mark_kind: "device" }])).toBe("device");
    expect(trialUsedByOther("new", [{ user_id: "old", mark_kind: "ip" }])).toBe("ip");
  });

  it("does not block the same account or a brand-new person", () => {
    expect(trialUsedByOther("me", [{ user_id: "me", mark_kind: "email" }])).toBeNull();
    expect(trialUsedByOther("me", [])).toBeNull();
  });

  it("collects email, device and internet address", () => {
    const marks = collectMarks({ email: "x@y.com", deviceId: "d_1234567890", ip: "203.0.113.5, 10.0.0.1" });
    expect(marks.map((m) => m.kind)).toEqual(["email", "device", "ip"]);
    expect(marks[2].value).toBe("203.0.113.5");
  });

  it("matches the database's email hash format", async () => {
    // Same formula the backfill used: sha256('oracle-trial-v1:email:' || normalized email)
    const h = await hashMark({ kind: "email", value: "juzzy@gmail.com" });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
