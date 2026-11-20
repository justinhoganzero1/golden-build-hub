// Built-in newsroom reporters for interview episodes. Each one has a news topic, a look,
// a voice and a personality, and the interview script is drafted for free (no AI call):
// the host hands over with questions that suit the reporter, the reporter delivers each
// point of the member's script. Every hand-over line is used once, never repeated.
import type { SpokenLine, Speaker } from "@/lib/newsroomScene";
import { splitSentences } from "@/lib/youtubeHost";

export type ReporterId = "jack" | "mia";

export interface Reporter {
  id: ReporterId;
  name: string;
  firstName: string;
  genre: string;
  personality: string;
  voiceId: string;
  voiceName: string;
  voiceSettings: Record<string, number | boolean>;
  /** How lively the still picture moves while talking (1 = normal). */
  energy: number;
  intro: string;
  handoffs: string[];
  thanks: string;
  outro: string;
}

export const REPORTERS: Reporter[] = [
  {
    id: "jack",
    name: "Jack Rourke",
    firstName: "Jack",
    genre: "Sport",
    personality: "Cheeky, high-energy Aussie who lives for game day.",
    voiceId: "IKne3meq5aSn9XLyUdCD",
    voiceName: "Aussie male, upbeat",
    voiceSettings: { stability: 0.4, similarity_boost: 0.85, style: 0.6, use_speaker_boost: true, speed: 1.05 },
    energy: 1.5,
    intro: "G'day! Cracker of a week, so let's get stuck in.",
    handoffs: [
      "Jack, what's the word from the ground?",
      "What's got the fans fired up?",
      "Who's the one to watch?",
      "Give us the numbers, mate.",
      "Any surprises in there?",
      "Where does it go from here?",
    ],
    thanks: "Cheers, Jack.",
    outro: "That's the wrap from me. Back to you in the studio!",
  },
  {
    id: "mia",
    name: "Mia Tran",
    firstName: "Mia",
    genre: "Tech & Science",
    personality: "Sharp, calm and curious; makes big ideas simple.",
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    voiceName: "Clear female, newsreader",
    voiceSettings: { stability: 0.6, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true, speed: 1.0 },
    energy: 0.9,
    intro: "Thanks. A lot is happening, so I'll keep it clear and simple.",
    handoffs: [
      "Mia, break this down for us.",
      "What does the research actually show?",
      "How does this affect everyday people?",
      "What are the experts saying?",
      "So what's the catch?",
      "What happens next?",
    ],
    thanks: "Thanks, Mia.",
    outro: "That's the science of it. Stay curious, and back to you.",
  },
];

export const reporterById = (id: string | null | undefined): Reporter | null =>
  REPORTERS.find((r) => r.id === id) ?? null;

export interface Turn { speaker: Speaker; text: string }

/** The member's script split into points (paragraphs, or groups of sentences). */
export function scriptPoints(script: string, max = 8): string[] {
  const paras = script.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (paras.length > 1) return paras.slice(0, max);
  const sentences = splitSentences(script);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) out.push(sentences.slice(i, i + 3).join(" "));
  return out.slice(0, max);
}

/** Free interview draft from the member's script. Each hand-over question appears once. */
export function draftInterview(script: string, reporter: Reporter, showName: string): Turn[] {
  const points = scriptPoints(script);
  if (!points.length) return [];
  const welcome = showName ? `Welcome to ${showName}. ` : "";
  const turns: Turn[] = [
    { speaker: "host", text: `${welcome}Joining me is our ${reporter.genre.toLowerCase()} reporter, ${reporter.name}.` },
    { speaker: "reporter", text: reporter.intro },
  ];
  points.forEach((p, i) => {
    const q = reporter.handoffs[i];
    if (q) turns.push({ speaker: "host", text: q });
    const prev = turns[turns.length - 1];
    if (!q && prev.speaker === "reporter") prev.text = `${prev.text} ${p}`;
    else turns.push({ speaker: "reporter", text: p });
  });
  turns.push({ speaker: "host", text: reporter.thanks });
  turns.push({ speaker: "reporter", text: reporter.outro });
  return turns;
}

const label = (s: Speaker, reporter: Reporter, anchorName: string) => (s === "host" ? anchorName || "Host" : reporter.firstName);

/** Turns → editable text, one "Name: line" per turn. */
export function formatTurns(turns: Turn[], reporter: Reporter, anchorName: string): string {
  return turns.map((t) => `${label(t.speaker, reporter, anchorName)}: ${t.text}`).join("\n\n");
}

/** Editable text → turns. Lines starting "Host:"/the anchor's name or "Reporter:"/the reporter's name switch speaker. */
export function parseInterview(text: string, reporter: Reporter, anchorName: string): Turn[] {
  const hostNames = new Set(["host", "anchor", (anchorName || "").trim().toLowerCase()].filter(Boolean));
  const repNames = new Set(["reporter", reporter.firstName.toLowerCase(), reporter.name.toLowerCase()]);
  const turns: Turn[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([^:]{1,40}):\s*(.*)$/);
    const who = m?.[1].trim().toLowerCase();
    let speaker: Speaker | null = null;
    if (who && hostNames.has(who)) speaker = "host";
    else if (who && repNames.has(who)) speaker = "reporter";
    const body = speaker ? m![2].trim() : line;
    if (!body) continue;
    const prev = turns[turns.length - 1];
    if (prev && (!speaker || prev.speaker === speaker)) { prev.text = `${prev.text} ${body}`; continue; }
    turns.push({ speaker: speaker ?? "host", text: body });
  }
  return turns;
}

/** Times each turn's sentences inside the turn's measured audio span. */
export function timeTurns(turns: Turn[], spans: Array<{ start: number; end: number }>): SpokenLine[] {
  const out: SpokenLine[] = [];
  turns.forEach((turn, i) => {
    const span = spans[i];
    if (!span) return;
    const sentences = splitSentences(turn.text);
    const parts = sentences.length ? sentences : [turn.text];
    const chars = parts.reduce((n, s) => n + s.length, 0) || 1;
    let t = span.start;
    parts.forEach((s) => {
      const d = ((span.end - span.start) * s.length) / chars;
      out.push({ text: s, start: t, end: t + d, speaker: turn.speaker });
      t += d;
    });
  });
  return out;
}

/** Mono 16-bit WAV, used to join the host and reporter voices into one soundtrack. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
