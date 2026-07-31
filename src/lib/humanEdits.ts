/**
 * Human-in-the-loop authorship tracking.
 *
 * Records which passages the human actually wrote or edited, versus what was
 * produced by AI, so the author can make an honest, evidence-backed claim of
 * substantial human authorship (the thing KDP/ACX/YouTube actually gate on).
 *
 * Stored locally per story so it survives reloads without bloating the DB.
 */

export interface EditEvent {
  at: string;             // ISO timestamp
  chapter: number;
  chapterTitle: string;
  source: "human" | "ai";
  /** Characters added (positive) or removed (negative) by this event. */
  delta: number;
  /** Short snippet of what changed — for the authorship log. */
  snippet: string;
  note?: string;
}

export interface AuthorshipReport {
  humanChars: number;
  aiChars: number;
  totalChars: number;
  humanPercent: number;
  humanEvents: number;
  aiEvents: number;
  firstEdit?: string;
  lastEdit?: string;
  events: EditEvent[];
}

const KEY = (storyId: string) => `oracle-lunar:authorship:${storyId || "new"}`;
const MAX_EVENTS = 4000;

export function loadEvents(storyId: string): EditEvent[] {
  try {
    const raw = localStorage.getItem(KEY(storyId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEvents(storyId: string, events: EditEvent[]) {
  try {
    localStorage.setItem(KEY(storyId), JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch { /* quota — ignore */ }
}

/** Record a change. `before`/`after` are the chapter texts around the change. */
export function recordEdit(
  storyId: string,
  opts: {
    chapter: number;
    chapterTitle: string;
    source: "human" | "ai";
    before: string;
    after: string;
    note?: string;
  },
): void {
  const delta = (opts.after?.length || 0) - (opts.before?.length || 0);
  if (delta === 0 && opts.source === "human") return;
  const snippet = diffSnippet(opts.before || "", opts.after || "");
  const events = loadEvents(storyId);
  const last = events[events.length - 1];
  // Coalesce rapid human typing into one event per 8 seconds per chapter.
  if (
    last &&
    last.source === "human" &&
    opts.source === "human" &&
    last.chapter === opts.chapter &&
    Date.now() - new Date(last.at).getTime() < 8000
  ) {
    last.delta += delta;
    last.snippet = snippet || last.snippet;
    last.at = new Date().toISOString();
  } else {
    events.push({
      at: new Date().toISOString(),
      chapter: opts.chapter,
      chapterTitle: opts.chapterTitle,
      source: opts.source,
      delta,
      snippet,
      note: opts.note,
    });
  }
  saveEvents(storyId, events);
}

function diffSnippet(before: string, after: string): string {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  return after.slice(Math.max(0, i - 30), i + 90).replace(/\s+/g, " ").trim().slice(0, 120);
}

export function buildReport(storyId: string): AuthorshipReport {
  const events = loadEvents(storyId);
  let humanChars = 0;
  let aiChars = 0;
  let humanEvents = 0;
  let aiEvents = 0;
  for (const e of events) {
    const mag = Math.abs(e.delta);
    if (e.source === "human") { humanChars += mag; humanEvents++; }
    else { aiChars += mag; aiEvents++; }
  }
  const totalChars = humanChars + aiChars;
  return {
    humanChars,
    aiChars,
    totalChars,
    humanPercent: totalChars ? (humanChars / totalChars) * 100 : 0,
    humanEvents,
    aiEvents,
    firstEdit: events[0]?.at,
    lastEdit: events[events.length - 1]?.at,
    events,
  };
}

/** A plain-text authorship log suitable for dropping into an export bundle. */
export function authorshipLogText(
  report: AuthorshipReport,
  meta: { title: string; author: string },
): string {
  const lines = [
    "HUMAN AUTHORSHIP LOG",
    `Work: ${meta.title || "Untitled"}`,
    `Author: ${meta.author || "Unknown"}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    `Human editing events: ${report.humanEvents}`,
    `AI generation events: ${report.aiEvents}`,
    `Characters written or revised by the human author: ${report.humanChars.toLocaleString()}`,
    `Characters produced by AI: ${report.aiChars.toLocaleString()}`,
    `Human contribution: ${report.humanPercent.toFixed(1)}% of tracked changes`,
    report.firstEdit ? `First tracked change: ${report.firstEdit}` : "",
    report.lastEdit ? `Last tracked change: ${report.lastEdit}` : "",
    "",
    "This log is an honest record. It does not claim the work is free of AI",
    "involvement — it documents the human's direct contribution alongside it.",
    "",
    "-- Change timeline (most recent 300) --",
  ].filter(Boolean);
  for (const e of report.events.slice(-300)) {
    lines.push(
      `${e.at} | ch${e.chapter + 1} "${e.chapterTitle}" | ${e.source.toUpperCase()} | ${e.delta >= 0 ? "+" : ""}${e.delta} chars | ${e.snippet}${e.note ? ` | ${e.note}` : ""}`,
    );
  }
  return lines.join("\n");
}

export function clearEvents(storyId: string) {
  try { localStorage.removeItem(KEY(storyId)); } catch { /* ignore */ }
}
