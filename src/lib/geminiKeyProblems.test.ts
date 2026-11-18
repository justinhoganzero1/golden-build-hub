import { describe, expect, it } from "vitest";
import { geminiProblemFrom, isVoiceYes, looksLikeGeminiKey } from "../../supabase/functions/_shared/geminiConsent";

describe("Google key problems", () => {
  it("treats Google's 'Please pass a valid API key' as a bad key", () => {
    expect(geminiProblemFrom(400, '[{"error":{"code":400,"message":"Please pass a valid API key","status":"INVALID_ARGUMENT"}}]')).toBe("invalid");
  });
  it("treats used-up allowance as needing credit", () => {
    expect(geminiProblemFrom(429, "RESOURCE_EXHAUSTED")).toBe("quota");
  });
  it("only counts a clear spoken yes as agreement", () => {
    expect(isVoiceYes("yes I agree")).toBe(true);
    expect(isVoiceYes("no I don't agree")).toBe(false);
  });
});

describe("looksLikeGeminiKey", () => {
  it("accepts classic AIza keys", () => {
    expect(looksLikeGeminiKey("AIza" + "a".repeat(35))).toBe(true);
  });
  it("accepts newer AQ. auth keys from Google AI Studio", () => {
    expect(looksLikeGeminiKey("AQ.Ab8" + "x".repeat(50))).toBe(true);
  });
  it("rejects other text", () => {
    expect(looksLikeGeminiKey("sk-" + "a".repeat(40))).toBe(false);
    expect(looksLikeGeminiKey("AQ.short")).toBe(false);
  });
});
