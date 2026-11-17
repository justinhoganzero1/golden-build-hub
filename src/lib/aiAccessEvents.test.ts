import { describe, expect, it, vi } from "vitest";
import { CARD_REQUIRED_EVENT, GEMINI_KEY_EVENT, handleAccessReply } from "./aiAccessEvents";

describe("access pop-ups", () => {
  it("asks for the card check when the trial needs a card", () => {
    const spy = vi.fn();
    window.addEventListener(CARD_REQUIRED_EVENT, spy);
    expect(handleAccessReply({ error: "card_required" })).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("raises the Google key alarm when Google refuses the member's key", () => {
    const spy = vi.fn();
    window.addEventListener(GEMINI_KEY_EVENT, spy);
    expect(handleAccessReply({ error: "gemini_key_problem", reason: "quota" })).toBe(true);
    expect((spy.mock.calls[0][0] as CustomEvent).detail.kind).toBe("problem");
  });

  it("does not blame the member's key when Google itself is down", () => {
    expect(handleAccessReply({ error: "gemini_key_problem", reason: "unavailable" })).toBe(false);
  });

  it("leaves wallet replies to the wallet modal", () => {
    expect(handleAccessReply({ error: "insufficient_coins" })).toBe(false);
  });
});
