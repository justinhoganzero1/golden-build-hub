export interface DeviceVoiceCandidate { name: string; lang: string; localService: boolean; }
export function deviceVoiceScore(voice: DeviceVoiceCandidate) {
  const name = voice.name.toLowerCase();
  return (/natural|neural|enhanced|premium|wavenet|online/.test(name) ? 100 : 0)
    + (!voice.localService ? 35 : 0)
    + (/^en[-_]AU$/i.test(voice.lang) ? 30 : /^en[-_]GB$/i.test(voice.lang) ? 12 : 0)
    + (/karen|catherine|natasha|hayley|samantha|zira|aria|jenny|libby|sonia|serena|moira|tessa|female/.test(name) ? 25 : 0)
    + (/google|microsoft|siri/.test(name) ? 10 : 0)
    // Flat, robotic or male system voices make Oracle sound low and sad.
    - (/compact|espeak|robot|novelty|whisper|bad news|bells|cellos|zarvox|trinoids|albert|fred|junior|ralph/.test(name) ? 80 : 0)
    - (/\b(male|david|mark|george|daniel|james|thomas|alex|lee|gordon|ryan|guy|william)\b/.test(name) ? 40 : 0);
}
export function chooseOracleDeviceVoice<T extends DeviceVoiceCandidate>(voices: T[]): T | undefined {
  return voices.filter(voice => /^en(?:[-_]|$)/i.test(voice.lang)).sort((a, b) => deviceVoiceScore(b) - deviceVoiceScore(a))[0];
}
export function naturalDeviceSpeechText(text: string) { return text.trim(); }

/** One spoken sentence with its own tone, so the free voice rises and falls like a person. */
export interface DevicePhrase { text: string; pitch: number; rate: number }
export type DeviceTone = "bright" | "gentle";

const LOW_MOODS = new Set(["crisis", "angry", "anxious", "sad", "lonely", "tired"]);
/** Cheerful by default; softer (but still warm, never low) when the member is struggling. */
export function deviceToneForMood(mood?: string | null): DeviceTone {
  return mood && LOW_MOODS.has(mood) ? "gentle" : "bright";
}

const clamp = (n: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, n)) * 100) / 100;

/**
 * The phone's built-in voices can't take sound filters, so we shape how they speak instead:
 * keep the punctuation (it drives the natural rise on questions and lift on exclamations),
 * speak a little higher and quicker than the flat default, and give each sentence its own
 * small change in tone so it never drones.
 */
export function shapeDeviceSpeech(input: string, tone: DeviceTone = "bright"): DevicePhrase[] {
  const text = input
    .replace(/\.{3,}|…/g, ", ")
    .replace(/\s+[—–-]+\s+|[—–]/g, ", ")
    .replace(/[*_#`~>[\]{}|<]/g, " ")
    .replace(/\s*,(\s*,)+/g, ",")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!text) return [];
  const basePitch = tone === "gentle" ? 1.03 : 1.1;
  const baseRate = tone === "gentle" ? 0.97 : 1.04;
  const wobble = [0, 0.02, -0.01, 0.01];
  const sentences = text.match(/[^.!?]+[.!?]*["')]*\s*/g) ?? [text];
  return sentences.map(s => s.trim()).filter(s => /[a-z0-9]/i.test(s)).map((sentence, i) => {
    const excited = /!["')]*$/.test(sentence);
    const question = /\?["')]*$/.test(sentence);
    const short = sentence.split(/\s+/).length <= 3;
    const lift = tone === "gentle" ? 0.5 : 1;
    const pitch = basePitch + wobble[i % wobble.length] + (excited ? 0.07 * lift : 0) + (question ? 0.04 * lift : 0);
    const rate = baseRate + (excited ? 0.04 * lift : 0) + (short ? 0.03 : 0);
    return { text: sentence, pitch: clamp(pitch, 0.95, 1.25), rate: clamp(rate, 0.9, 1.15) };
  });
}
