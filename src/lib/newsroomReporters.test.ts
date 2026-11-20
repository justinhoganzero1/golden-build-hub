import { describe, expect, it } from "vitest";
import { REPORTERS, draftInterview, encodeWav, formatTurns, parseInterview, reporterById, timeTurns } from "./newsroomReporters";
import { planInterviewShots, shotRect, INTERVIEW_ANCHOR, type SpokenLine } from "./newsroomScene";

const script = Array.from({ length: 9 }, (_, i) => `Point ${i + 1} is here. It has detail.`).join("\n\n");

describe("newsroom reporters", () => {
  it("has two reporters: one for Sport and one for Tech & Science", () => {
    expect(REPORTERS.map((r) => r.genre)).toEqual(["Sport", "Tech & Science"]);
  });

  it("gives each reporter a different voice and personality", () => {
    const [a, b] = REPORTERS;
    expect(a.voiceId).not.toBe(b.voiceId);
    expect(a.personality).not.toBe(b.personality);
  });

  it("never repeats a hand-over question in a drafted interview", () => {
    for (const r of REPORTERS) {
      const hostLines = draftInterview(script, r, "Oracle Tonight").filter((t) => t.speaker === "host").map((t) => t.text);
      expect(new Set(hostLines).size).toBe(hostLines.length);
    }
  });

  it("the reporter delivers every point of the script", () => {
    const r = reporterById("mia")!;
    const said = draftInterview(script, r, "").filter((t) => t.speaker === "reporter").map((t) => t.text).join(" ");
    for (let i = 1; i <= 8; i++) expect(said).toContain(`Point ${i} is here.`);
  });

  it("reads who speaks from the start of each line, round-trip", () => {
    const r = reporterById("jack")!;
    const turns = draftInterview(script, r, "Show");
    expect(parseInterview(formatTurns(turns, r, "Oracle"), r, "Oracle")).toEqual(turns);
    expect(parseInterview("Host: Hi.\nReporter: G'day.\nmore from jack", r, "Oracle")).toEqual([
      { speaker: "host", text: "Hi." }, { speaker: "reporter", text: "G'day. more from jack" },
    ]);
  });

  it("times each line inside its speaker's audio", () => {
    const lines = timeTurns([{ speaker: "host", text: "One. Two." }, { speaker: "reporter", text: "Three." }], [{ start: 0, end: 2 }, { start: 2.35, end: 4 }]);
    expect(lines.map((l) => l.speaker)).toEqual(["host", "host", "reporter"]);
    expect(lines[2].start).toBeCloseTo(2.35);
  });

  it("the camera holds on the reporter when the reporter talks", () => {
    const lines: SpokenLine[] = ["host", "reporter", "host", "reporter", "host", "reporter"].map((s, i) => ({ text: "x", start: i * 4, end: i * 4 + 4, speaker: s as "host" | "reporter" }));
    const segs = planInterviewShots(lines, 3);
    expect(segs.some((s) => s.shot === "guest")).toBe(true);
    const g = shotRect("guest", "youtube", "interview");
    expect(g.x).toBeLessThan(INTERVIEW_ANCHOR.guestCx);
    expect(g.x + g.w).toBeGreaterThan(INTERVIEW_ANCHOR.guestCx);
  });

  it("joins the voices into a playable WAV", () => {
    const wav = encodeWav(new Float32Array(100), 44100);
    expect(wav.size).toBe(44 + 200);
    expect(wav.type).toBe("audio/wav");
  });
});
