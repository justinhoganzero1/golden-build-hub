import { describe, expect, it } from "vitest";
import { takeSpeakablePrefix, VOICE_FINAL_PAUSE_MS, VOICE_INTERIM_PAUSE_MS } from "./oracleVoiceTiming";

describe("Oracle low-latency voice", () => {
  it("removes the two-second final transcript wait", () => {
    expect(VOICE_FINAL_PAUSE_MS).toBeLessThan(500);
    expect(VOICE_INTERIM_PAUSE_MS).toBeGreaterThan(VOICE_FINAL_PAUSE_MS);
  });
  it("speaks the first complete sentence before the answer is finished", () => {
    const text = "Yes, I can help. Here is the rest";
    expect(text.slice(0, takeSpeakablePrefix(text))).toBe("Yes, I can help. ");
  });
  it("starts with a complete early clause rather than waiting for a long sentence", () => {
    const text = "To get your book ready, we will check";
    expect(text.slice(0, takeSpeakablePrefix(text))).toBe("To get your book ready, ");
  });
  it("does not speak incomplete words or internal commands", () => {
    expect(takeSpeakablePrefix("A partial sentence")).toBe(0);
    expect(takeSpeakablePrefix("[[GEN_IMAGE:secret, pending")).toBe(0);
    expect(takeSpeakablePrefix("Done.", true)).toBe(5);
  });
});