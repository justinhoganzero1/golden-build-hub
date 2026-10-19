import { describe, expect, it, beforeEach, vi } from "vitest";
import { readDraft, writeDraft, recoveryFor } from "./recovery";
describe("reliability protections", () => {
  beforeEach(() => localStorage.clear());
  it.each([401, 402, 403, 429, 500, 502, undefined])("never automatically replays an uncertain or denied operation (%s)", status => {
    expect(recoveryFor(status).automaticReplay).toBe(false);
  });
  it("keeps an unsent chat and its partial reply after a reload", () => {
    writeDraft("member-a", "oracle", { input: "Unsent question", messages: [{ content: "Partial reply" }] });
    expect(readDraft("member-a", "oracle")).toEqual({ input: "Unsent question", messages: [{ content: "Partial reply" }] });
  });
  it("does not return another member's drafts", () => {
    writeDraft("member-a", "book:123", { chapters: ["Private text"] });
    expect(readDraft("member-b", "book:123")).toBeNull();
  });
  it("retains the previous draft when storage is full", () => {
    writeDraft("member-a", "oracle", "original");
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(writeDraft("member-a", "oracle", "new")).toBe(false);
    set.mockRestore();
    expect(readDraft("member-a", "oracle")).toBe("original");
  });
});