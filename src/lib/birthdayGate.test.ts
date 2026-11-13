import { describe, it, expect } from "vitest";
import { checkBirthday, needsBirthdayStep, signedInWithGoogle } from "./birthdayGate";

const today = new Date(2026, 10, 13); // 13 Nov 2026
const google = { app_metadata: { provider: "google", providers: ["google"] } };
const email = { app_metadata: { provider: "email", providers: ["email"] } };

describe("birthday step (16+)", () => {
  it("lets someone who turned 16 today in", () => {
    expect(checkBirthday("2010-11-13", today)).toBe("ok");
  });
  it("blocks someone who turns 16 tomorrow", () => {
    expect(checkBirthday("2010-11-14", today)).toBe("too-young");
  });
  it("rejects an empty or silly birthday", () => {
    expect(checkBirthday("", today)).toBe("missing");
    expect(checkBirthday("1899-12-31", today)).toBe("invalid");
  });
  it("asks Google sign-ups with no saved birthday", () => {
    expect(signedInWithGoogle(google)).toBe(true);
    expect(needsBirthdayStep(google, null)).toBe(true);
  });
  it("does not ask again once the birthday is saved", () => {
    expect(needsBirthdayStep(google, "1990-05-01")).toBe(false);
  });
  it("does not ask email sign-ups (they answered on the form)", () => {
    expect(needsBirthdayStep(email, null)).toBe(false);
  });
  it("asks email accounts that later linked Google", () => {
    expect(needsBirthdayStep({ app_metadata: { provider: "email" }, identities: [{ provider: "email" }, { provider: "google" }] }, null)).toBe(true);
  });
});
