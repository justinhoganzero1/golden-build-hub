import { describe, expect, it } from "vitest";
import { chooseOracleDeviceVoice, deviceToneForMood, naturalDeviceSpeechText, shapeDeviceSpeech } from "./oracleDeviceVoice";
describe("Oracle device speech", () => {
  it("prefers available natural Australian female delivery over a basic local voice", () => {
    const voices = [{ name: "Basic", lang: "en-US", localService: true }, { name: "Natasha Natural", lang: "en-AU", localService: false }];
    expect(chooseOracleDeviceVoice(voices)?.name).toBe("Natasha Natural");
  });
  it("passes over male and robotic system voices when a female voice exists", () => {
    const voices = [{ name: "Google UK English Male", lang: "en-GB", localService: false }, { name: "eSpeak English", lang: "en", localService: true }, { name: "Google US English Female", lang: "en-US", localService: true }];
    expect(chooseOracleDeviceVoice(voices)?.name).toBe("Google US English Female");
  });
  it("keeps question and exclamation punctuation unchanged instead of adding full stops", () => {
    expect(naturalDeviceSpeechText("  Really? That’s fantastic!  ")).toBe("Really? That’s fantastic!");
  });
  it("returns no invented voice when English speech is unavailable", () => {
    expect(chooseOracleDeviceVoice([{ name: "French", lang: "fr-FR", localService: true }])).toBeUndefined();
  });
  it("speaks each sentence separately and keeps its punctuation for natural intonation", () => {
    const phrases = shapeDeviceSpeech("Hi there! How are you going today? I'm here to help.");
    expect(phrases.map(p => p.text)).toEqual(["Hi there!", "How are you going today?", "I'm here to help."]);
  });
  it("speaks brighter than the flat default and lifts on exclamations", () => {
    const [excited, plain] = shapeDeviceSpeech("That is wonderful news! Let us get started.");
    expect(plain.pitch).toBeGreaterThan(1);
    expect(excited.pitch).toBeGreaterThan(plain.pitch);
  });
  it("softens, but never drops below a normal pitch, when the member is sad", () => {
    expect(deviceToneForMood("sad")).toBe("gentle");
    expect(deviceToneForMood("happy")).toBe("bright");
    const [gentle] = shapeDeviceSpeech("I'm right here with you.", "gentle");
    const [bright] = shapeDeviceSpeech("I'm right here with you.", "bright");
    expect(gentle.pitch).toBeGreaterThanOrEqual(1);
    expect(gentle.pitch).toBeLessThan(bright.pitch);
  });
  it("turns trailing dots and dashes into pauses instead of reading them out", () => {
    expect(shapeDeviceSpeech("Well... let me think — yes.")[0].text).toBe("Well, let me think, yes.");
  });
});
import { cleanTextForDeviceSpeech } from "./utils";
describe("free voice text tidy-up", () => {
  it("keeps sentence punctuation and drops markdown so the voice can rise and fall", () => {
    expect(cleanTextForDeviceSpeech("**Great news!**\nAre you ready?")).toBe("Great news! Are you ready?");
  });
  it("never inserts commas mid-sentence in long sentences", () => {
    const long = "Koalas in New South Wales have recently received an extra twenty four million dollars for bushland corridors.";
    expect(cleanTextForDeviceSpeech(long)).toBe(long);
  });
});
