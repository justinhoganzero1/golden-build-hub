import { describe, expect, it } from "vitest";
import { chooseOracleDeviceVoice, naturalDeviceSpeechText } from "./oracleDeviceVoice";
describe("Oracle device speech", () => {
  it("prefers available natural Australian female delivery over a basic local voice", () => {
    const voices = [{ name: "Basic", lang: "en-US", localService: true }, { name: "Natasha Natural", lang: "en-AU", localService: false }];
    expect(chooseOracleDeviceVoice(voices)?.name).toBe("Natasha Natural");
  });
  it("keeps question and exclamation punctuation unchanged instead of adding full stops", () => {
    expect(naturalDeviceSpeechText("  Really? That’s fantastic!  ")).toBe("Really? That’s fantastic!");
  });
  it("returns no invented voice when English speech is unavailable", () => {
    expect(chooseOracleDeviceVoice([{ name: "French", lang: "fr-FR", localService: true }])).toBeUndefined();
  });
});