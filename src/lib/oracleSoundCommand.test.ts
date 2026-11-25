import { describe, it, expect } from "vitest";
import { parseSoundCommand } from "./oracleHumanSounds";
describe("parseSoundCommand", () => {
  it("stop farting turns cheeky off", () => expect(parseSoundCommand("Please stop farting")).toEqual({ cheeky: false }));
  it("turn off burps and farts", () => expect(parseSoundCommand("turn off the burps and farts")).toEqual({ cheeky: false }));
  it("turn off all sounds", () => expect(parseSoundCommand("turn off your sounds")).toEqual({ human: false }));
  it("turn sounds back on", () => expect(parseSoundCommand("turn your sounds back on")).toEqual({ human: true, cheeky: true }));
  it("ignores normal chat", () => expect(parseSoundCommand("what sounds good for dinner")).toBeNull());
});
