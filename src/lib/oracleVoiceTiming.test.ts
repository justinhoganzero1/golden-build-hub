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
import { mergeQueuedSpeech } from "./oracleVoiceTiming";

describe("mergeQueuedSpeech", () => {
  it("joins Oracle's waiting sentences into one flowing run", () => {
    const q = [{ text: "Second one.", agentName: "Lunar" }, { text: "Third one.", agentName: "Lunar" }];
    expect(mergeQueuedSpeech("First one.", q, "Lunar")).toEqual({ text: "First one. Second one. Third one.", taken: 2 });
  });
  it("never merges another speaker's words", () => {
    const q = [{ text: "Hi from Max.", agentName: "Max" }, { text: "Back to me.", agentName: "Lunar" }];
    expect(mergeQueuedSpeech("Hello.", q, "Lunar")).toEqual({ text: "Hello.", taken: 0 });
  });
  it("stops at an item whose voice is already prepared", () => {
    const q = [{ text: "Ready.", agentName: "Lunar", audio: Promise.resolve(null) }];
    expect(mergeQueuedSpeech("Hello.", q, "Lunar").taken).toBe(0);
  });
  it("keeps each run under the length cap", () => {
    const q = [{ text: "b".repeat(300), agentName: "Lunar" }];
    expect(mergeQueuedSpeech("a".repeat(300), q, "Lunar", 500).taken).toBe(0);
  });
});
