// Guided discovery for brand-new members: Oracle greets them first and the
// app's modules "unlock" as she introduces them in conversation. This is a
// soft guide only — locked tiles still open through Oracle, safety pages are
// always open, "Show me everything" unlocks all, and members who joined before
// the rollout (and the owner) see everything as before.

export const DISCOVERY_ROLLOUT = "2026-11-12T00:00:00Z";

/** Always reachable, whatever has been unlocked. Safety first. */
export const ALWAYS_OPEN = ["/oracle", "/crisis-hub", "/safety-center", "/media-library", "/settings", "/wallet", "/profile", "/founder-seats", "/membership"];

export interface DiscoverableModule { label: string; path: string; words: RegExp }

export const MODULES: DiscoverableModule[] = [
  { label: "Movie Studio", path: "/movie-studio-pro", words: /\b(movie|film|cinema|trailer)s?\b/i },
  { label: "Video Editor", path: "/video-editor", words: /\b(video|edit(ing)? (a |my )?clip|reel|tiktok)s?\b/i },
  { label: "YouTube Studio", path: "/youtube-show-studio", words: /\byou ?tube|vlog|channel\b/i },
  { label: "Story Writer", path: "/story-writer", words: /\b(story|stories|book|novel|write|writing|author|kindle|kdp)\b/i },
  { label: "Photo Studio", path: "/photography-hub", words: /\b(photo|picture|selfie|logo|brand|camera)s?\b/i },
  { label: "Avatar Gen", path: "/avatar-generator", words: /\bavatars?\b/i },
  { label: "Magic Hub", path: "/magic-hub", words: /\b(art|draw|paint|image|illustrat\w*)s?\b/i },
  { label: "Voice Studio", path: "/voice-studio", words: /\b(voice|song|music|sing|podcast)s?\b/i },
  { label: "Teleport ✨", path: "/teleport", words: /\bteleport\b/i },
  { label: "Realm Builder", path: "/realm-builder", words: /\b(realm|world ?build\w*|3d world)s?\b/i },
  { label: "Public Realms", path: "/realms", words: /\brealms\b/i },
  { label: "Oracle Videos", path: "/oracle-videos", words: /\boracle videos?\b/i },
  { label: "App Builder", path: "/app-builder", words: /\b((build|make|create) (me )?(an? )?(app|website|game)|website|coding)\b/i },
  { label: "Inventor", path: "/inventor", words: /\b(invent\w*|patent)s?\b/i },
  { label: "Pro Hub", path: "/professional-hub", words: /\b(business|career|resume|cv)s?\b/i },
  { label: "POS Learn", path: "/pos-learn", words: /\b(pos|point of sale|retail)\b/i },
  { label: "Calendar", path: "/calendar", words: /\b(calendar|diary|schedule|appointment|plan my (day|week))s?\b/i },
  { label: "Alarm Clock", path: "/alarm-clock", words: /\b(alarm|wake me|reminder)s?\b/i },
  { label: "Occasions", path: "/special-occasions", words: /\b(birthday|anniversary|occasion|gift)s?\b/i },
  { label: "Mind Hub", path: "/mind-hub", words: /\b(stress|anxious|anxiety|meditat\w*|mindful\w*|wellbeing|mental health|sleep)\b/i },
  { label: "Family Hub", path: "/family-hub", words: /\b(family|kids?|children|parent\w*)\b/i },
  { label: "Elderly Care", path: "/elderly-care", words: /\b(elderly|medication|pills?|nan|grandma|grandpa|aged care)\b/i },
  { label: "Audio Filter", path: "/audio-filter", words: /\baudio filter|noise\b/i },
  { label: "Assistant", path: "/personal-assistant", words: /\b(assistant|organi[sz]e|to-?do)s?\b/i },
  { label: "Interpreter", path: "/interpreter", words: /\b(translat\w*|interpret\w*|language)s?\b/i },
  { label: "Live Vision", path: "/live-vision", words: /\b(live vision|what am i looking at|scan this)\b/i },
  { label: "AI Council", path: "/oracle?council=1", words: /\bcouncil\b/i },
];

export interface UnlockState { all: boolean; paths: string[] }

const key = (userId: string) => `oracle-unlocks:v1:${userId}`;
export const UNLOCKS_EVENT = "oracle-unlocks-change";

export const basePath = (path: string) => path.split(/[?#]/)[0] || "/";

/** Only accounts created on/after the rollout get the guided unlock; the owner never does. */
export function needsGuidedUnlock(createdAt: string | null | undefined, owner: boolean): boolean {
  if (owner || !createdAt) return false;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && t >= new Date(DISCOVERY_ROLLOUT).getTime();
}

export function loadUnlocks(userId: string | null | undefined): UnlockState {
  if (!userId || typeof localStorage === "undefined") return { all: false, paths: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)) || "null");
    if (raw && typeof raw === "object") {
      return { all: raw.all === true, paths: Array.isArray(raw.paths) ? raw.paths.filter((p: unknown) => typeof p === "string").slice(0, 100) : [] };
    }
  } catch { /* fall through */ }
  return { all: false, paths: [] };
}

function save(userId: string, state: UnlockState): UnlockState {
  try { localStorage.setItem(key(userId), JSON.stringify(state)); } catch { /* storage full */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UNLOCKS_EVENT, { detail: state }));
  return state;
}

/** Returns the modules that were newly unlocked (already-open ones are skipped). */
export function unlockPaths(userId: string | null | undefined, paths: string[]): DiscoverableModule[] {
  if (!userId) return [];
  const state = loadUnlocks(userId);
  const fresh = paths.map(p => moduleForPath(p)).filter((m): m is DiscoverableModule => !!m && !isUnlocked(state, m.path));
  if (!fresh.length) return [];
  save(userId, { ...state, paths: [...new Set([...state.paths, ...fresh.map(m => basePath(m.path))])] });
  return fresh;
}

export function unlockEverything(userId: string | null | undefined): void {
  if (userId) save(userId, { ...loadUnlocks(userId), all: true });
}

export function isUnlocked(state: UnlockState, path: string): boolean {
  const base = basePath(path);
  return state.all || ALWAYS_OPEN.includes(base) || state.paths.includes(base);
}

export function moduleForPath(path: string): DiscoverableModule | undefined {
  const base = basePath(path);
  return MODULES.find(m => m.path === path) || MODULES.find(m => basePath(m.path) === base);
}

/** Modules the member's own words point to (at most two, so it never floods). */
export function modulesForText(text: string): DiscoverableModule[] {
  if (!text) return [];
  return MODULES.filter(m => m.words.test(text)).slice(0, 2);
}

/** Paths from Oracle's silent [[UNLOCK:/path]] markers. */
export function unlockMarkers(text: string): string[] {
  return [...text.matchAll(/\[\[UNLOCK:\s*(\/[^\]\s]*)\s*\]\]/gi)].map(m => m[1]);
}

/** Short private note telling Oracle which apps this new member hasn't met yet. */
export function discoveryNote(state: UnlockState): string | null {
  if (state.all) return null;
  const locked = MODULES.filter(m => !isUnlocked(state, m.path));
  if (!locked.length) return null;
  return locked.slice(0, 12).map(m => `${m.label} (${m.path})`).join(", ");
}
