import { describe, it, expect } from "vitest";
import { parseVideoJob, videoDuration } from "../../supabase/functions/_shared/videoContract";

describe("durable real video contract", () => {
  it("retains a completed job identifier rather than resubmitting", () => {
    expect(parseVideoJob({ id: "existing-job", status: "completed", seconds: "3" })).toEqual({ id: "existing-job", status: "completed", seconds: 3 });
  });
  it("rejects missing job ids and invalid progress states", () => {
    expect(() => parseVideoJob({ status: "completed" })).toThrow();
    expect(() => parseVideoJob({ id: "job", status: "success" })).toThrow();
  });
  it("validates supported clip lengths before paid submission", () => {
    expect(videoDuration(3)).toBe(3);
    expect(videoDuration(10)).toBe(10);
    expect(() => videoDuration(11)).toThrow();
  });
});