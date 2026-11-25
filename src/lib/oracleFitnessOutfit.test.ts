import { describe, it, expect } from "vitest";
import { parseOutfitCommand } from "./oracleOutfit";
const fit = (t: string) => expect(parseOutfitCommand(t)).toEqual({ kind: "fitness" });
describe("fitness outfit requests", () => {
  it("fitness clothing", () => fit("change into your fitness clothing"));
  it("typo fitnes", () => fit("put your fitnes clothes on"));
  it("gym clothes", () => fit("can you get in your gym clothes please"));
  it("active wear", () => fit("wear your active wear"));
  it("change back still resets", () => expect(parseOutfitCommand("change back")).toEqual({ kind: "reset" }));
});
