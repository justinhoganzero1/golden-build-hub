import { describe, expect, it } from "vitest";
import { chooseFitnessVideo, isFreshTemplate, makeFitnessTemplate, normalizeExercise, type VideoCandidate } from "../../supabase/functions/_shared/fitnessVideo";
const candidate = (id: string, title: string, embeddable = true): VideoCandidate => ({ id, snippet: { title, channelTitle: "Exercise Instructor" }, status: { embeddable, privacyStatus: "public" } });
describe("reusable fitness videos", () => {
  it("reuses one key for star jumps and jumping jacks", () => expect(normalizeExercise("star-jumps")).toBe(normalizeExercise("jumping jacks")));
  it("only reuses unexpired metadata", () => {
    expect(isFreshTemplate({ expires_at: "2026-11-26T00:00:00Z" }, Date.parse("2026-11-25T00:00:00Z"))).toBe(true);
    expect(isFreshTemplate({ expires_at: "2026-11-24T00:00:00Z" }, Date.parse("2026-11-25T00:00:00Z"))).toBe(false);
  });
  it("chooses instruction instead of the first popular challenge", () => {
    expect(chooseFitnessVideo([candidate("aaaaaaaaaaa", "Lunges challenge"), candidate("bbbbbbbbbbb", "Lunges proper form tutorial")], "lunges")?.id).toBe("bbbbbbbbbbb");
  });
  it("rejects non-embeddable footage", () => expect(chooseFitnessVideo([candidate("aaaaaaaaaaa", "Lunges tutorial", false)], "lunges")).toBeNull());
  it("does not cache medical requests", () => expect(normalizeExercise("injury rehab")).toBeNull());
  it("expires metadata after seven days", () => {
    const t = makeFitnessTemplate(candidate("aaaaaaaaaaa", "Lunges tutorial"), "lunges", 0);
    expect(Date.parse(t.expires_at)).toBe(7 * 86400000);
    expect(t.exercise_key).toBe("lunges");
  });
});