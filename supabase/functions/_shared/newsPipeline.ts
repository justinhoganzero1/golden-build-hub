// Oracle News story-by-story production line — pure rules (tested by Vitest).
// Every discovered story moves through these stages; nothing is marked ready to
// broadcast unless its script, narration text and a visual (or fallback graphic) exist.

export const STAGES = [
  "discovered", "content_retrieved", "analysing", "script_ready", "searching_footage",
  "footage_verified", "ready_to_broadcast", "presenter_speaking", "broadcast_complete", "failed", "expired",
] as const;
export type Stage = typeof STAGES[number];

export const STAGE_LABEL: Record<Stage, string> = {
  discovered: "Discovered",
  content_retrieved: "Content retrieved",
  analysing: "Analysing",
  script_ready: "Script ready",
  searching_footage: "Searching for footage",
  footage_verified: "Footage verified",
  ready_to_broadcast: "Ready to broadcast",
  presenter_speaking: "Presenter speaking",
  broadcast_complete: "Broadcast complete",
  failed: "Failed — requires attention",
  expired: "Not used — older than 36 hours",
};

/** Script sections in the order the presenter reads them. */
export const SECTION_KEYS = ["intro", "what_happened", "where_when", "who", "background", "figures", "why_it_matters", "what_next", "closing"] as const;
export type SectionKey = typeof SECTION_KEYS[number];
export const SECTION_LABEL: Record<SectionKey, string> = {
  intro: "Introduction", what_happened: "What happened", where_when: "Where and when", who: "Who is involved",
  background: "Background", figures: "Key figures", why_it_matters: "Why it matters", what_next: "What happens next", closing: "Closing",
};
const REQUIRED: SectionKey[] = ["intro", "what_happened", "why_it_matters", "closing"];

export interface ScriptSection { key: SectionKey; label: string; text: string }
export interface VisualQuery { section: SectionKey; query: string }

export const MAX_ATTEMPTS = 3;
export const NEWS_WINDOW_HOURS = 36;
export const RETRY_AFTER_MINUTES = 30;

/** Turn the AI reply into clean ordered sections; returns null if a required part is missing. */
export function normaliseSections(raw: unknown): ScriptSection[] | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const out: ScriptSection[] = [];
  for (const key of SECTION_KEYS) {
    const v = obj[key];
    const text = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    if (text && !/^(n\/?a|none|not (reliably )?(established|known|reported)\.?|unknown\.?)$/i.test(text)) out.push({ key, label: SECTION_LABEL[key], text: text.slice(0, 1200) });
  }
  for (const k of REQUIRED) if (!out.some((s) => s.key === k)) return null;
  return out;
}

/** The AI's visual search ideas, kept specific (2–6 words) and tied to a real section. */
export function normaliseVisualQueries(raw: unknown, sections: ScriptSection[]): VisualQuery[] {
  if (!Array.isArray(raw)) return [];
  const have = new Set(sections.map((s) => s.key));
  const seen = new Set<string>();
  const out: VisualQuery[] = [];
  for (const r of raw) {
    const section = (r as any)?.section as SectionKey;
    const query = String((r as any)?.query ?? "").replace(/[^\p{L}\p{N}\s'.-]/gu, " ").replace(/\s+/g, " ").trim();
    const words = query.split(" ").filter(Boolean).length;
    if (!have.has(section) || words < 1 || words > 6 || seen.has(query.toLowerCase())) continue;
    seen.add(query.toLowerCase());
    out.push({ section, query: query.slice(0, 60) });
    if (out.length >= 4) break;
  }
  return out;
}

export interface LicenceVerdict { allowed: boolean; commercial_use: boolean; editing_allowed: boolean; approval_status: "public_domain" | "approved" | "denied"; licence: string; note: string }

/** Wikimedia Commons licence check: public domain, CC0, CC BY and CC BY-SA only (never NC/ND or unknown). */
export function commonsLicence(shortName: string | null | undefined): LicenceVerdict {
  const name = String(shortName ?? "").replace(/<[^>]+>/g, "").trim();
  const n = name.toLowerCase();
  const deny = (note: string): LicenceVerdict => ({ allowed: false, commercial_use: false, editing_allowed: false, approval_status: "denied", licence: name || "Unknown", note });
  if (!n) return deny("No licence stated");
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|fair use|copyrighted|all rights/i.test(n)) return deny("Licence does not allow commercial use or editing");
  if (/public domain|^pd\b|^pd-|cc0|cc-zero/.test(n)) {
    return { allowed: true, commercial_use: true, editing_allowed: true, approval_status: "public_domain", licence: name, note: "Public domain on Wikimedia Commons — credit given as good practice." };
  }
  if (/^cc[ -]by([ -]sa)?(\s|-|$)/.test(n)) {
    const sa = /sa/.test(n.replace(/^cc[ -]by/, ""));
    return {
      allowed: true, commercial_use: true, editing_allowed: true, approval_status: "approved", licence: name,
      note: `Creative Commons ${sa ? "Attribution-ShareAlike" : "Attribution"} — commercial use allowed with credit${sa ? "; edited versions of the clip itself must be shared under the same licence" : ""}.`,
    };
  }
  return deny(`Licence "${name}" isn't on the approved list`);
}

/** A found file only counts as relevant when its title names every key word of the search (no filler footage). */
export function isRelevant(query: string, title: string): boolean {
  const stem = (w: string) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w);
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 4 && !/^(news|with|from|that|this|their|about|over|after|city)$/.test(w)).map(stem);
  if (!words.length) return false;
  const t = title.toLowerCase().replace(/[_-]+/g, " ");
  // Every key word must appear: one shared word ("briefing", "parliament") isn't the same subject.
  return words.slice(0, 4).every((w) => t.includes(w));
}

export interface Visual { id: string; section: string | null; media_type: "video" | "image" | "graphic"; media_url: string | null; rating: string; playback_status: string; title?: string; attribution?: string | null; embed_url?: string | null; source_kind?: string | null }
export type PlannedVisual =
  | { kind: "video" | "image"; url: string; visual_id: string; credit: string | null }
  | { kind: "embed"; url: string; visual_id: string; credit: string | null }
  | { kind: "graphic"; label: string };

/** A real clip of the story from another channel, shown only through that site's own player with a credit banner. */
export function isStoryClip(v: Pick<Visual, "embed_url" | "source_kind" | "rating" | "playback_status">): boolean {
  return v.source_kind === "youtube_clip" && !!v.embed_url && v.rating !== "red" && v.playback_status !== "failed";
}

/** Spoken thank-you after a borrowed clip, like a real newsreader. */
export function thanksLine(credit: string | null | undefined): string {
  const who = String(credit ?? "").trim();
  return who ? `Our thanks to ${who} for that footage.` : "Our thanks to the original broadcaster for that footage.";
}

/**
 * Picks the visual for each script section. When the story has a real clip, it runs behind every section
 * between the introduction and the closing (split across two clips when there are two). Otherwise:
 * same-section video first, then picture, then any story visual, else a graphic.
 */
export function planSectionVisuals(sections: ScriptSection[], visuals: Visual[]): PlannedVisual[] {
  const clips = visuals.filter(isStoryClip).slice(0, 2);
  if (clips.length) {
    const middle = sections.map((_, i) => i).filter((i) => i > 0 && i < sections.length - 1 || sections.length <= 2);
    const half = Math.ceil(middle.length / clips.length);
    const fallback = planSectionVisuals(sections, visuals.filter((v) => !isStoryClip(v)));
    return sections.map((_, i) => {
      const pos = middle.indexOf(i);
      if (pos < 0) return fallback[i];
      const c = clips[Math.min(clips.length - 1, Math.floor(pos / half))];
      return { kind: "embed", url: c.embed_url!, visual_id: c.id, credit: c.attribution ?? null };
    });
  }
  const usable = visuals.filter((v) => v.rating === "green" && v.media_url && v.playback_status !== "failed" && v.media_type !== "graphic" && !v.embed_url);
  const rank = (v: Visual) => (v.media_type === "video" ? 0 : 1);
  const used = new Set<string>();
  return sections.map((s, i) => {
    const own = usable.filter((v) => v.section === s.key).sort((a, b) => rank(a) - rank(b));
    const spare = usable.filter((v) => !used.has(v.id)).sort((a, b) => rank(a) - rank(b));
    const pick = own[0] ?? (i > 0 ? spare[0] : undefined) ?? own[0];
    if (!pick) return { kind: "graphic", label: s.label };
    used.add(pick.id);
    return { kind: pick.media_type as "video" | "image", url: pick.media_url!, visual_id: pick.id, credit: pick.attribution ?? null };
  });
}

/** Broadcast-ready only with a full script and something to show for every section (fallback graphic counts). */
export function readyToBroadcast(sections: ScriptSection[] | null | undefined): boolean {
  return !!sections && REQUIRED.every((k) => sections.some((s) => s.key === k && s.text.length > 20));
}

/** Discovered stories that fell out of the news window are closed off instead of sitting in the queue forever. */
export function shouldExpire(s: { production_status: string; last_updated: string }, now = Date.now()): boolean {
  if (!["discovered", "failed"].includes(s.production_status)) return false;
  return now - new Date(s.last_updated).getTime() > NEWS_WINDOW_HOURS * 3600_000;
}

/** Failed stories get retried automatically, at most MAX_ATTEMPTS times, with a pause between tries. */
export function canRetry(s: { production_status: string; production_attempts: number; production_updated_at: string | null }, now = Date.now()): boolean {
  if (s.production_status !== "failed" || s.production_attempts >= MAX_ATTEMPTS) return false;
  if (!s.production_updated_at) return true;
  return now - new Date(s.production_updated_at).getTime() >= RETRY_AFTER_MINUTES * 60_000;
}

/** Word count → seconds at a steady news-reading pace. */
export function sectionSeconds(text: string, wpm = 155): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(2, Math.round((words / wpm) * 60));
}

/** Ranking for "top trending anywhere in the world": no home-country bonus, unusable stories left out. */
export function trendScore(s: { importance: number | null; region?: string | null }): number {
  return (s.importance ?? 0) - (s.region === "au" ? 12 : 0);
}

export const TOP_STORIES = 10;

/** The top trending stories (default ten) — only these are produced and broadcast. */
export function topTrending<T extends { importance: number | null; region?: string | null; status?: string | null; verification?: string | null; production_status?: string | null }>(stories: T[], n = TOP_STORIES): T[] {
  return stories
    .filter((s) => s.status !== "dismissed" && s.production_status !== "expired" && s.verification !== "corrected_or_withdrawn" && s.verification !== "unverified")
    .sort((a, b) => trendScore(b) - trendScore(a))
    .slice(0, n);
}

export interface ClipCandidate { videoId: string; title: string; channel: string; live?: string | null }

/** Well-known news broadcasters: only their clips are used, so junk re-upload channels never reach the screen. */
const NEWS_CHANNEL = /\b(abc|sky news|bbc|cnn|reuters|associated press|\bap\b|al jazeera|9 ?news|nine news|7 ?news|10 ?news|sbs|guardian|nbc|cbs|fox news|fox business|dw|france 24|cbc|wion|bloomberg|cnbc|pbs|itv|channel 4|euronews|times radio|nzherald|1news|rnz|the telegraph|washington post|new york times|wall street journal|sky news australia|global news|ctv|nhk|cna|south china morning post|ani news|community media|60 minutes|today show|sunrise|a current affair|the project|msnbc|newsmax|al arabiya|trt world|nbc news|abc news)\b/i;
export function isNewsChannel(channel: string): boolean { return NEWS_CHANNEL.test(channel); }

/** Real clips of the actual story: the title must share the story's key words (news broadcasters first); best two, one per channel. */
export function pickStoryClips(headlineTokens: string[], candidates: Array<ClipCandidate & { tokens: string[] }>, score: (a: string[], b: string[]) => number, min = 0.3): ClipCandidate[] {
  const seen = new Set<string>();
  return candidates
    .filter((c) => c.videoId && (!c.live || c.live === "none"))
    .map((c) => ({ c, s: score(headlineTokens, c.tokens), news: isNewsChannel(c.channel) }))
    .filter((x) => x.news && x.s >= min)
    .sort((a, b) => Number(b.news) - Number(a.news) || b.s - a.s)
    .filter((x) => (seen.has(x.c.channel) ? false : (seen.add(x.c.channel), true)))
    .slice(0, 2)
    .map((x) => ({ videoId: x.c.videoId, title: x.c.title, channel: x.c.channel }));
}
