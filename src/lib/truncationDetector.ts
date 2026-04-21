/**
 * Lightweight detector for messages that look like they were cut off at the
 * start (e.g. "udio on my device" instead of "audio on my device"). Used by
 * the Oracle chat to surface a quick clarification dialog before sending a
 * malformed prompt to the model.
 */

export type TruncationTopic = "audio" | "video" | "unknown";

export interface TruncationGuess {
  truncated: boolean;
  topic: TruncationTopic;
  fragment: string;
  /** Confidence 0–1. Threshold for prompting the user is ~0.6. */
  confidence: number;
}

// Common openings that frequently get clipped in voice/typing flows. Order matters
// — longer / more specific patterns first.
const PATTERNS: Array<{ re: RegExp; topic: TruncationTopic; conf: number }> = [
  { re: /^\s*udio\b/i,        topic: "audio",   conf: 0.95 }, // "audio" -> "udio"
  { re: /^\s*ound\b/i,        topic: "audio",   conf: 0.85 }, // "sound" -> "ound"
  { re: /^\s*icrophone\b/i,   topic: "audio",   conf: 0.95 }, // "microphone" -> "icrophone"
  { re: /^\s*ic\b/i,          topic: "audio",   conf: 0.6  }, // "mic" -> "ic"
  { re: /^\s*peaker/i,        topic: "audio",   conf: 0.9  }, // "speaker" -> "peaker"
  { re: /^\s*olume\b/i,       topic: "audio",   conf: 0.85 }, // "volume" -> "olume"
  { re: /^\s*ideo\b/i,        topic: "video",   conf: 0.9  }, // "video" -> "ideo"
  { re: /^\s*amera\b/i,       topic: "video",   conf: 0.9  }, // "camera" -> "amera"
];

export function detectTruncation(raw: string): TruncationGuess {
  const text = (raw || "").trim();
  if (!text) return { truncated: false, topic: "unknown", fragment: "", confidence: 0 };

  for (const { re, topic, conf } of PATTERNS) {
    if (re.test(text)) {
      return { truncated: true, topic, fragment: text, confidence: conf };
    }
  }

  // Heuristic: very short message (< 4 chars) that begins with a vowel cluster
  // following a missing consonant — low confidence catch-all.
  if (text.length <= 6 && /^[aeiou]{1,2}[a-z]+$/i.test(text)) {
    return { truncated: true, topic: "unknown", fragment: text, confidence: 0.4 };
  }

  return { truncated: false, topic: "unknown", fragment: text, confidence: 0 };
}
