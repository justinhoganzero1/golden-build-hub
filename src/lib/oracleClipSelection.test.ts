import { describe, expect, it } from "vitest";
import { choosePresenterClip, feedbackKey, oracleToolDestination, presenterHistory, type PresenterClip } from "./oracleClipSelection";
const clips: PresenterClip[] = ["a", "b", "c"].map(id => ({ id, url: `${id}.webm`, states: ["idle"], approved: true, silent: true }));
describe("Oracle presentation safeguards", () => {
  it("avoids recently played clips when an alternative exists", () => { expect(choosePresenterClip(clips, "idle", ["a", "b"])?.id).toBe("c"); });
  it("avoids the immediately previous clip after pool exhaustion", () => { expect(choosePresenterClip(clips, "idle", ["b", "c", "a"])?.id).not.toBe("a"); });
  it("falls back honestly without approved silent footage for the state", () => {
    expect(choosePresenterClip(clips, "speaking", [])).toBeNull();
    expect(choosePresenterClip([{ ...clips[0], approved: false }, { ...clips[1], silent: false }], "idle", [])).toBeNull();
  });
  it("allows a finite single-clip pool to repeat without claiming uniqueness", () => { expect(choosePresenterClip([clips[0]], "idle", ["a"])?.id).toBe("a"); });
  it("bounds history to twelve clips", () => { expect(presenterHistory(Array.from({ length: 12 }, (_, i) => String(i)), "next")).toEqual([...Array.from({ length: 11 }, (_, i) => String(i + 1)), "next"]); });
  it("keeps feedback account scoped", () => { expect(feedbackKey("member-a")).not.toBe(feedbackKey("member-b")); });
  it("only embeds local tool paths and never a second Oracle", () => { expect(oracleToolDestination("/story-writer")).toBe(true); expect(oracleToolDestination("//outside.com")).toBe(false); expect(oracleToolDestination("/oracle?council=1")).toBe(false); });
});