import { describe, it, expect } from "vitest";
import { normaliseSections, normaliseVisualQueries, commonsLicence, isRelevant, planSectionVisuals, readyToBroadcast, shouldExpire, canRetry } from "../../supabase/functions/_shared/newsPipeline";

const full = {
  intro: "Good evening, tonight's top story comes from Canberra where talks went late.",
  what_happened: "The federal government announced a new housing package on Thursday afternoon.",
  where_when: "N/A",
  why_it_matters: "Rents have climbed for three years, so the package affects millions of renters.",
  closing: "We'll keep across that story. Now to the rest of the day's news.",
};

describe("news script sections", () => {
  it("keeps sections in reading order and drops 'not established' parts", () => {
    const s = normaliseSections(full)!;
    expect(s.map((x) => x.key)).toEqual(["intro", "what_happened", "why_it_matters", "closing"]);
  });
  it("rejects a script that only reads the headline (no 'what happened' or 'why it matters')", () => {
    expect(normaliseSections({ intro: "Housing package announced.", closing: "Back to you." })).toBeNull();
  });
  it("only keeps specific visual searches tied to a real section, max 4", () => {
    const s = normaliseSections(full)!;
    const q = normaliseVisualQueries([
      { section: "what_happened", query: "Parliament House Canberra" },
      { section: "who", query: "Anthony Albanese" }, // no 'who' section
      { section: "intro", query: "a very long search phrase that goes on and on" },
      { section: "why_it_matters", query: "Sydney apartments" },
    ], s);
    expect(q).toEqual([{ section: "what_happened", query: "Parliament House Canberra" }, { section: "why_it_matters", query: "Sydney apartments" }]);
  });
});

describe("footage licences", () => {
  it("accepts public domain, CC0, CC BY and CC BY-SA", () => {
    expect(commonsLicence("Public domain").approval_status).toBe("public_domain");
    expect(commonsLicence("CC0").allowed).toBe(true);
    expect(commonsLicence("CC BY 3.0").allowed).toBe(true);
    expect(commonsLicence("CC BY-SA 4.0").commercial_use).toBe(true);
  });
  it("refuses non-commercial, no-derivatives and unknown licences", () => {
    expect(commonsLicence("CC BY-NC 4.0").allowed).toBe(false);
    expect(commonsLicence("CC BY-ND 2.0").allowed).toBe(false);
    expect(commonsLicence("").allowed).toBe(false);
    expect(commonsLicence("Fair use").allowed).toBe(false);
  });
  it("never accepts unrelated footage", () => {
    expect(isRelevant("Parliament House Canberra", "File:Timelapse of the facade of Parliament House Canberra.webm")).toBe(true);
    expect(isRelevant("Parliament House Canberra", "File:Kittens playing.webm")).toBe(false);
    expect(isRelevant("White House news briefing", "File:CDC Briefing Room- COVID-19 Update.webm")).toBe(false);
    expect(isRelevant("Artemis", "File:Artemis I launch.webm")).toBe(true);
    expect(isRelevant("White House press briefings", "File:White House Press Briefing (5017).jpg")).toBe(true);
    expect(isRelevant("London Parliament Square demonstrations", "File:Palestinian protest Parliament Sq in London.webm")).toBe(false);
    expect(isRelevant("Victoria north west farms", "File:Grange Road north of Victoria Farm estate.jpg")).toBe(false);
  });
});

describe("section visuals", () => {
  it("prefers moving footage, falls back to pictures, then to a graphic — never a broken player", () => {
    const s = normaliseSections(full)!;
    const plan = planSectionVisuals(s, [
      { id: "img", section: "what_happened", media_type: "image", media_url: "https://x/a.jpg", rating: "green", playback_status: "ok" },
      { id: "vid", section: "what_happened", media_type: "video", media_url: "https://x/a.webm", rating: "green", playback_status: "ok" },
      { id: "bad", section: "intro", media_type: "video", media_url: "https://x/b.webm", rating: "green", playback_status: "failed" },
      { id: "red", section: "closing", media_type: "video", media_url: "https://x/c.webm", rating: "red", playback_status: "ok" },
    ]);
    expect(plan[0]).toEqual({ kind: "graphic", label: "Introduction" });
    expect(plan[1]).toMatchObject({ kind: "video", visual_id: "vid" });
    expect(plan[2]).toMatchObject({ kind: "image", visual_id: "img" });
    expect(plan[3]).toEqual({ kind: "graphic", label: "Closing" });
  });
});

describe("production queue", () => {
  it("is broadcast-ready only with a full script", () => {
    expect(readyToBroadcast(normaliseSections(full))).toBe(true);
    expect(readyToBroadcast(null)).toBe(false);
  });
  it("closes off discovered stories older than 36 hours", () => {
    const now = Date.parse("2026-11-21T00:00:00Z");
    expect(shouldExpire({ production_status: "discovered", last_updated: "2026-11-19T11:00:00Z" }, now)).toBe(true);
    expect(shouldExpire({ production_status: "discovered", last_updated: "2026-11-20T11:00:00Z" }, now)).toBe(false);
    expect(shouldExpire({ production_status: "ready_to_broadcast", last_updated: "2026-11-01T00:00:00Z" }, now)).toBe(false);
  });
  it("retries a failed story up to 3 times, 30 minutes apart", () => {
    const now = Date.parse("2026-11-21T01:00:00Z");
    expect(canRetry({ production_status: "failed", production_attempts: 1, production_updated_at: "2026-11-21T00:20:00Z" }, now)).toBe(true);
    expect(canRetry({ production_status: "failed", production_attempts: 1, production_updated_at: "2026-11-21T00:45:00Z" }, now)).toBe(false);
    expect(canRetry({ production_status: "failed", production_attempts: 3, production_updated_at: null }, now)).toBe(false);
  });
});
