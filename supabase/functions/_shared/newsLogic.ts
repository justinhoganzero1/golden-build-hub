// Oracle News Intelligence — pure, testable rules (no network, no database).
// Used by the news-controller function and by the app's tests.

export interface FeedEntry {
  title: string;
  link: string;
  guid: string;
  summary: string;
  published: string | null;
  videoId?: string;
  thumbnail?: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripTags(m[1]) : "";
}

function attr(block: string, name: string, attribute: string): string {
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

/** Parse RSS 2.0 <item> or Atom <entry> blocks, including YouTube channel feeds. */
export function parseFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = tag(b, "title");
    let link = tag(b, "link");
    if (!link || !/^https?:/i.test(link)) {
      const alt = b.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ?? b.match(/<link\b[^>]*href=["']([^"']+)["']/i);
      link = alt ? decodeEntities(alt[1]) : "";
    }
    if (!title || !/^https?:/i.test(link)) continue;
    const guid = tag(b, "guid") || tag(b, "id") || link;
    const summary = (tag(b, "description") || tag(b, "summary") || tag(b, "media:description") || tag(b, "content")).slice(0, 1200);
    const published = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date") || null;
    const videoId = tag(b, "yt:videoId") || undefined;
    const thumbnail = attr(b, "media:thumbnail", "url") || undefined;
    out.push({ title, link, guid, summary, published: published ? safeIso(published) : null, videoId, thumbnail });
  }
  return out;
}

export function safeIso(s: string): string | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Remove tracking parameters and fragments so the same article is recognised twice. */
export function normaliseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|at_|cmp|ocid|fbclid|gclid|sf\d*)/i.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch { return url.trim(); }
}

/** One key per news organisation, so two ABC feeds don't count as two independent sources. */
export function publisherKey(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^(www|feeds|news|rss)\./, "");
    if (host.endsWith("bbci.co.uk") || host.endsWith("bbc.co.uk") || host.endsWith("bbc.com")) return "bbc";
    const parts = host.split(".");
    const generic = new Set(["com", "net", "org", "gov", "co", "edu", "int"]);
    if (parts.length >= 3 && generic.has(parts[parts.length - 2])) return parts.slice(-3).join(".");
    return parts.slice(-2).join(".");
  } catch { return url; }
}

const STOP = new Set(("the a an and or but of to in on at for with from by as is are was were be been has have had it its this that these those " +
  "after before over under into about up out new says say said will would could can may more most than amid after against off near " +
  "live updates update news video watch australia australian latest first year years day days week how why what who when where " +
  "january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday").split(" "));

export function titleTokens(title: string): string[] {
  const words = title.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/);
  const out = new Set<string>();
  for (let w of words) {
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
    if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    out.add(w);
  }
  return [...out];
}

/** Share of words two headlines have in common (0–1). */
export function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  const shared = a.filter((w) => sb.has(w)).length;
  if (shared < 2) return 0;
  return shared / Math.min(a.length, b.length);
}

export const SAME_STORY = 0.5;

/**
 * Items that don't belong to a story: neither their headline nor a headline that matches the
 * story's own headline is similar enough. Used to undo old false groupings (self-healing).
 */
export function strayItemIndexes(storyHeadline: string, titles: string[]): number[] {
  const head = titleTokens(storyHeadline);
  const toks = titles.map(titleTokens);
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const core = toks.map((t, i) => norm(titles[i]) === norm(storyHeadline) || similarity(t, head) >= SAME_STORY);
  return toks.map((t, i) => (core[i] || toks.some((o, j) => core[j] && j !== i && similarity(t, o) >= SAME_STORY) ? -1 : i)).filter((i) => i >= 0);
}

/** Best existing story for a new headline, or null when it is a new story. */
export function bestMatch<T extends { tokens: string[] }>(tokens: string[], candidates: T[], threshold = SAME_STORY): T | null {
  let best: T | null = null; let score = 0;
  for (const c of candidates) {
    const s = similarity(tokens, c.tokens);
    if (s >= threshold && s > score) { best = c; score = s; }
  }
  return best;
}

export function clusterKeyFor(tokens: string[], firstSeenIso: string): string {
  return `${firstSeenIso.slice(0, 10)}:${[...tokens].sort().slice(0, 8).join("-")}`;
}

export type Verification = "corroborated" | "single_source" | "developing" | "conflicting" | "unverified" | "corrected_or_withdrawn";

export const VERIFICATION_LABEL: Record<Verification, string> = {
  corroborated: "Multiple-source corroboration",
  single_source: "Single-source reporting",
  developing: "Developing story",
  conflicting: "Conflicting reports",
  unverified: "Unverified",
  corrected_or_withdrawn: "Corrected or withdrawn",
};

export function classifyVerification(input: { publishers: string[]; titles: string[]; conflicts?: string | null; hoursOld: number }): Verification {
  const distinct = new Set(input.publishers).size;
  if (input.titles.some((t) => /\b(correction|corrected|retract(ed|ion)|withdrawn|clarification)\b/i.test(t))) return "corrected_or_withdrawn";
  if (input.conflicts && input.conflicts.trim()) return "conflicting";
  if (distinct >= 2) return "corroborated";
  if (distinct === 1) return input.hoursOld < 6 ? "developing" : "single_source";
  return "unverified";
}

export interface Settings {
  story_count: number;
  duration_minutes: number;
  au_share: number;
  categories: string[];
  breaking_priority: boolean;
}

export interface StoryForScore {
  id: string;
  region: string;
  category: string;
  source_count: number;
  official_count: number;
  verification: string;
  hoursOld: number;
  is_breaking: boolean;
  status: string;
}

export function importanceScore(s: Omit<StoryForScore, "id" | "status">, settings: Pick<Settings, "breaking_priority">): number {
  let score = Math.min(s.source_count, 6) * 10 + Math.min(s.official_count, 3) * 6;
  if (s.region === "au") score += 12;
  score += Math.max(0, 24 - s.hoursOld) * 0.8;
  if (s.verification === "corroborated") score += 15;
  if (s.verification === "conflicting") score -= 5;
  if (s.verification === "unverified" || s.verification === "corrected_or_withdrawn") score -= 40;
  if (s.is_breaking && settings.breaking_priority) score += 25;
  return Math.round(score * 10) / 10;
}

/** Editorial director: pick the most important unused stories, honouring the Australian share and categories. */
export function selectStories<T extends StoryForScore & { importance: number }>(stories: T[], settings: Settings): T[] {
  const cats = new Set(settings.categories);
  const pool = stories
    .filter((s) => s.status !== "used" && s.status !== "dismissed")
    .filter((s) => s.verification !== "unverified" && s.verification !== "corrected_or_withdrawn")
    .filter((s) => s.hoursOld <= 36)
    .filter((s) => cats.size === 0 || cats.has(s.category) || cats.has("general"))
    .sort((a, b) => b.importance - a.importance);
  const n = settings.story_count;
  const auTarget = Math.round((n * settings.au_share) / 100);
  const au = pool.filter((s) => s.region === "au").slice(0, auTarget);
  const intl = pool.filter((s) => s.region !== "au").slice(0, n - au.length);
  const picked = [...au, ...intl];
  if (picked.length < n) for (const s of pool) { if (picked.length >= n) break; if (!picked.includes(s)) picked.push(s); }
  return picked.sort((a, b) => b.importance - a.importance);
}

/** Breaking when a fresh story is suddenly reported widely or officially confirmed by another outlet. */
export function isBreaking(s: { source_count: number; official_count: number; hoursOld: number; verification: string }): boolean {
  if (s.hoursOld > 3) return false;
  if (s.verification === "unverified" || s.verification === "corrected_or_withdrawn") return false;
  return s.source_count >= 3 || (s.official_count >= 1 && s.source_count >= 2);
}

export type Rating = "green" | "amber" | "red";

export interface RightsInput {
  source_kind: string;
  commercial_use: boolean;
  editing_allowed: boolean;
  approval_status: string;
  permission_expiry: string | null;
}

/** Footage traffic light. Short clips are never assumed to be legal; s103B news exemption is never auto-applied. */
export function rateFootage(f: RightsInput, today = new Date().toISOString().slice(0, 10)): Rating {
  if (f.approval_status === "denied") return "red";
  if (f.permission_expiry && f.permission_expiry < today) return "red";
  if (f.source_kind === "nasa_video") return "green"; // US Government public domain (NASA media guidelines)
  if ((f.approval_status === "approved" || f.approval_status === "public_domain") && f.commercial_use && f.editing_allowed) return "green"; // licence-verified (e.g. Commons PD / CC BY)
  if (f.source_kind === "youtube_clip") return "amber"; // real story clip: plays in YouTube's own player with a credit banner, never copied
  if (f.source_kind === "youtube_rss") return "amber"; // official channel: embed via YouTube's own player only
  return f.approval_status === "approved" ? "amber" : "red";
}

/** Only green footage that Oracle Lunar holds a copy of can go into a downloadable broadcast. */
export function usableInDownload(f: { rating: string; file_path: string | null }): boolean {
  return f.rating === "green" && !!f.file_path;
}

/** Minimal robots.txt check for the "*" group and our own bot name. */
export function robotsAllows(robots: string, path: string, agent = "oraclelunarnewsbot"): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(); const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase()); lastWasAgent = true;
    } else if (cur && (key === "allow" || key === "disallow")) {
      lastWasAgent = false;
      if (val) cur.rules.push({ allow: key === "allow", path: val });
    } else lastWasAgent = false;
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!mine) return true;
  let best: { allow: boolean; path: string } | null = null;
  for (const r of mine.rules) {
    const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
    if (new RegExp(`^${pattern}`).test(path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best ? best.allow : true;
}

export const BRISBANE_OFFSET_HOURS = 10; // Queensland has no daylight saving

export function brisbaneClock(now: Date): { date: string; hour: number } {
  const local = new Date(now.getTime() + BRISBANE_OFFSET_HOURS * 3600_000);
  return { date: local.toISOString().slice(0, 10), hour: local.getUTCHours() };
}

export type DailyStep = "research" | "produce" | null;

/** 5 am research (scan + analysis), 6 am production (script + footage), ready for 7 am. */
export function dailyStepDue(now: Date, done: { research?: string; produce?: string }, mode: string): DailyStep {
  const { date, hour } = brisbaneClock(now);
  if (hour >= 5 && done.research !== date) return "research";
  if (mode !== "manual" && hour >= 6 && done.research === date && done.produce !== date) return "produce";
  return null;
}

export function nextBroadcastAt(now: Date): Date {
  const { date, hour } = brisbaneClock(now);
  const target = new Date(`${date}T07:00:00+10:00`);
  return hour < 7 ? target : new Date(target.getTime() + 86400_000);
}

export const WORDS_PER_MINUTE = 150;
export function wordBudget(minutes: number): number { return Math.max(1, minutes) * WORDS_PER_MINUTE; }
export function estimateSeconds(script: string): number {
  const words = script.trim() ? script.trim().split(/\s+/).length : 0;
  return Math.round((words / WORDS_PER_MINUTE) * 60);
}

/** Initial broadcast status for each production mode. */
export function initialStatus(mode: string): "approved" | "awaiting_approval" | "scripted" {
  if (mode === "automatic") return "approved";
  if (mode === "approval") return "awaiting_approval";
  return "scripted";
}

const SPACE_WORDS = /\b(nasa|space|moon|lunar|mars|rocket|astronaut|artemis|telescope|satellite|orbit|launch|iss|asteroid|planet|galaxy|comet|spacex|solar|eclipse|webb|hubble)\b/i;
export function looksLikeSpaceStory(text: string): boolean { return SPACE_WORDS.test(text); }

/** Search words for the NASA archive: the most repeated proper names in the story, else headline words. */
export function nasaQuery(headline: string, summary = ""): string {
  const text = `${headline} ${summary}`;
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/\b([A-Z][a-z][a-zA-Z0-9]{2,})\b/g)) {
    const w = m[1];
    if (/^(NASA|APOD|Astronomy|Picture|Oracle|News|Sources|Unconfirmed|This|That|There|They|Their|What|When|While|After|Before|Its|The|And|But|With|From)$/.test(w) || STOP.has(w.toLowerCase())) continue;
    counts.set(w, (counts.get(w) ?? 0) + (headline.includes(w) ? 2 : 1));
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w);
  return (top.length ? top : titleTokens(headline).slice(0, 3)).join(" ");
}

/** Extract readable paragraph text from an article page (bounded). */
export function extractArticleText(html: string, max = 3500): string {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ");
  const paras = (body.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? []).map(stripTags).filter((p) => p.length > 60);
  let out = "";
  for (const p of paras) { if (out.length + p.length > max) break; out += (out ? "\n" : "") + p; }
  return out;
}
