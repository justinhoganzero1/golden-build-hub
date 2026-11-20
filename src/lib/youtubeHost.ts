// YouTube Host Studio — pure helpers (layout sizes, caption timing, slide beats).
// The on-camera host is an animated photo (gentle sway + breathing), never
// presented as lip-synced, because no verified lip-sync engine is wired in.

export type HostFormat = "youtube" | "shorts";
export type HostLayout = "full" | "corner";

export interface CanvasSize { width: number; height: number }

export function canvasSizeFor(format: HostFormat): CanvasSize {
  return format === "shorts" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
}

/** Where the host picture sits on the canvas (x, y, w, h). */
export function hostBox(format: HostFormat, layout: HostLayout): { x: number; y: number; w: number; h: number } {
  const { width, height } = canvasSizeFor(format);
  if (layout === "corner") {
    const w = Math.round(format === "shorts" ? width * 0.42 : width * 0.3);
    const h = Math.round(w * 1.25);
    return { x: width - w - 32, y: height - h - (format === "shorts" ? 260 : 32), w, h };
  }
  return { x: 0, y: 0, w: width, h: height };
}

/** Splits a script into spoken sentences (keeps punctuation). */
export function splitSentences(script: string): string[] {
  return String(script || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface TimedLine { text: string; start: number; end: number }

/** Spreads sentences over the narration length in proportion to their length. */
export function timeSentences(sentences: string[], durationSec: number): TimedLine[] {
  const total = sentences.reduce((n, s) => n + Math.max(1, s.length), 0);
  if (!total || !(durationSec > 0)) return [];
  let t = 0;
  return sentences.map((text) => {
    const len = (Math.max(1, text.length) / total) * durationSec;
    const line = { text, start: t, end: t + len };
    t += len;
    return line;
  });
}

export function lineAt(lines: TimedLine[], t: number): TimedLine | null {
  return lines.find((l) => t >= l.start && t < l.end) ?? (lines.length && t >= lines[lines.length - 1].end ? null : null);
}

/** Short on-screen headlines (one per paragraph, max 6) for the slide side. */
export function slideBeats(script: string, max = 6): string[] {
  return String(script || "")
    .split(/\n\s*\n|\n/)
    .map((p) => splitSentences(p)[0] || "")
    .map((s) => s.replace(/[.!?]+$/, ""))
    .map((s) => (s.length > 70 ? `${s.slice(0, 67).trimEnd()}…` : s))
    .filter((s) => s.length > 3)
    .slice(0, max);
}

/** Word-wraps text into lines that fit maxWidth using a measure function. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxWidth || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    return kept;
  }
  return lines;
}

/** Picks a recording type the browser supports; mp4 first so YouTube/phones accept it. */
export function pickRecorderType(isSupported: (t: string) => boolean): { mime: string; ext: "mp4" | "webm" } | null {
  const options: Array<[string, "mp4" | "webm"]> = [
    ["video/mp4;codecs=avc1,mp4a", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of options) if (isSupported(mime)) return { mime, ext };
  return null;
}
