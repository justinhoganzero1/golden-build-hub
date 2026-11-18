import { describe, it, expect } from "vitest";
import { isTrialPaidCreation, readChatAccess, scriptedOracleReply, trialPaidReply } from "./oracleTrial";

describe("Oracle free trial", () => {
  it("trial members get documents, stories, poems, pictures and video creations", () => {
    for (const k of ["DOC", "STORY", "POEM", "IMAGE", "VIDEO"]) expect(isTrialPaidCreation("trial", k)).toBe(false);
  });
  it("music, sound effects, narrations and app builds are paid-plan creations in the trial", () => {
    for (const k of ["MUSIC", "SFX", "VOICE", "APP"]) expect(isTrialPaidCreation("trial", k)).toBe(true);
  });
  it("paying members are never blocked from creations", () => {
    expect(isTrialPaidCreation("paid", "MUSIC")).toBe(false);
  });
  it("apps are explained as Pro, music as Plus", () => {
    expect(trialPaidReply("APP")).toContain("Pro");
    expect(trialPaidReply("MUSIC")).toContain("Plus");
  });
  it("unknown access header counts as paid", () => {
    expect(readChatAccess(null)).toBe("paid");
    expect(readChatAccess("trial")).toBe("trial");
  });
});

describe("after the trial Oracle falls back to simple scripted help", () => {
  it("still opens free pages", () => {
    expect(scriptedOracleReply("open my calendar").path).toBe("/calendar");
    expect(scriptedOracleReply("show my library").path).toBe("/media-library");
  });
  it("crisis words always open Crisis Help first", () => {
    expect(scriptedOracleReply("I want to hurt myself, check my calendar").path).toBe("/crisis-hub");
  });
  it("other questions get the kind trial-finished reply with no page", () => {
    const r = scriptedOracleReply("what is the capital of France?");
    expect(r.path).toBeUndefined();
    expect(r.reply).toMatch(/trial has finished/);
  });
  it("a Google key with no credit gets its own explanation", () => {
    expect(scriptedOracleReply("explain gravity", "key_out").reply).toMatch(/Google key/);
  });
});
