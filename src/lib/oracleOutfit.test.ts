import { describe, it, expect, beforeEach } from "vitest";
import { loadOutfit, saveOutfit, outfitPrompt, OUTFIT_PRESETS } from "./oracleOutfit";

describe("Oracle outfits", () => {
  beforeEach(() => localStorage.clear());
  it("remembers each member's outfit separately", () => {
    saveOutfit("a", { url: "https://x/a.png", label: "Casual" });
    expect(loadOutfit("a")?.label).toBe("Casual");
    expect(loadOutfit("b")).toBeNull();
  });
  it("going back to the original clears it", () => {
    saveOutfit("a", { url: "https://x/a.png", label: "Casual" });
    saveOutfit("a", null);
    expect(loadOutfit("a")).toBeNull();
  });
  it("photo outfits copy only the clothing and keep her face and room", () => {
    const p = outfitPrompt({ photo: true });
    expect(p).toMatch(/second image/);
    expect(p).toMatch(/ignore any person, face or background/);
    expect(p).toMatch(/change only the clothing/);
    expect(p).toMatch(/fully clothed/);
  });
  it("offers ready-made outfits", () => expect(OUTFIT_PRESETS.length).toBeGreaterThanOrEqual(6));
});

import { parseOutfitCommand, isStandby } from "./oracleOutfit";
describe("asking Oracle to change outfit in the chat", () => {
  it("understands a described outfit", () => {
    expect(parseOutfitCommand("Can you wear a red leather jacket?")).toEqual({ kind: "describe", description: "a red leather jacket" });
    expect(parseOutfitCommand("Oracle, change into a summer dress please")?.kind).toBe("describe");
    expect(parseOutfitCommand("put on a cosy hoodie")).toEqual({ kind: "describe", description: "a cosy hoodie" });
  });
  it("understands 'wear this' as the photo they sent", () => {
    expect(parseOutfitCommand("wear this")).toEqual({ kind: "photo" });
    expect(parseOutfitCommand("Could you wear the outfit in the photo?")).toEqual({ kind: "photo" });
  });
  it("understands going back to her original outfit", () => {
    expect(parseOutfitCommand("go back to your original outfit")).toEqual({ kind: "reset" });
  });
  it("ignores normal chat", () => {
    expect(parseOutfitCommand("What should I wear to the party?")).toBeNull();
    expect(parseOutfitCommand("put on some music")).toBeNull();
    expect(parseOutfitCommand("I love your outfit")).toBeNull();
  });
});
describe("standby video", () => {
  it("starts after 3 minutes of no activity, not before", () => {
    expect(isStandby(0, 179_000)).toBe(false);
    expect(isStandby(0, 180_000)).toBe(true);
  });
});

import { parseOutfitCommand as p2 } from "./oracleOutfit";
import { it as it2, expect as ex2 } from "vitest";
it2("workout gear request changes instantly", () => {
  ex2(p2("put on your workout gear")?.kind).toBe("fitness");
  ex2(p2("change into your gym outfit")?.kind).toBe("fitness");
  ex2(p2("change your outfit")?.kind).toBe("ask");
  ex2(p2("wear a red dress")?.kind).toBe("describe");
});

it2("fitness mode phrasing switches to workout outfit", () => {
  for (const t of ["fitness mode", "go into fitness instructor mode", "let's work out", "put on your workout gear"]) ex2(p2(t)).toEqual({ kind: "fitness" });
});
