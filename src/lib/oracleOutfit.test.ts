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
    expect(p).toMatch(/change only her clothing/);
    expect(p).toMatch(/fully clothed/);
  });
  it("offers ready-made outfits", () => expect(OUTFIT_PRESETS.length).toBeGreaterThanOrEqual(6));
});
