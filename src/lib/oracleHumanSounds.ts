// Oracle's human sounds: a soft breath, sigh or giggle before she speaks, breaths
// between sentences, the odd burp and an occasional loud fart with a wet, runny tail (followed by an embarrassed blush).
// All sounds are small prerecorded clips played on the device — free, never a
// paid generation — and they respect mute and the member's settings.
import type { Mood } from "@/lib/oracleMood";
import type { LookGender } from "@/lib/oracleLook";

export type HumanSoundKind = "breath" | "sigh" | "laugh" | "burp" | "fart";
export interface HumanSoundPrefs { human: boolean; cheeky: boolean }
export interface HumanSoundState { replies: number; lastBurp: number; lastFart: number; fartsThisSession: number }

/** Burp: about 1 in 12 replies, never closer than 8 replies apart. */
export const BURP_CHANCE = 1 / 12;
export const BURP_MIN_GAP = 8;
/** Fart: about 1 in 35 replies, not in the first 6, at least 25 replies apart, at most 2 per visit. */
export const FART_CHANCE = 1 / 35;
export const FART_MIN_REPLIES = 6;
export const FART_MIN_GAP = 25;
export const FART_MAX_PER_VISIT = 2;
/** Chances for the soft sounds before she talks. */
export const LAUGH_CHANCE = 0.75;
export const SIGH_CHANCE = 0.7;
export const BREATH_CHANCE = 0.6;
/** Breaths between sentences of a longer reply (free device voice). */
export const MID_BREATH_CHANCE = 0.45;
export const MID_BREATH_MIN_SENTENCES = 2;

export const DEFAULT_PREFS: HumanSoundPrefs = { human: true, cheeky: true };
export const freshSoundState = (): HumanSoundState => ({ replies: 0, lastBurp: -BURP_MIN_GAP, lastFart: -FART_MIN_GAP, fartsThisSession: 0 });

/** Moods where cheeky noises or giggles would feel uncaring. */
const SERIOUS: Mood[] = ["crisis", "sad", "anxious", "angry", "lonely"];
const LAUGHY = /\b(?:haha+|hehe+|lol)\b|😂|🤣|😄|😆|😅|😁/i;
const SIGHY = /^(?:oh+|aw+|ah+|hmm+|phew|well|mmm+)\b|\b(?:that sounds (?:hard|tough|rough)|i'm so sorry|sending (?:you )?love)\b/i;

/** Decides which (if any) sound plays before this reply. Pure, so the rules stay testable. */
export function pickHumanSound(text: string, state: HumanSoundState, prefs: HumanSoundPrefs, mood: Mood | null = null, rng: () => number = Math.random): HumanSoundKind | null {
  if (!prefs.human || !text.trim()) return null;
  const serious = !!mood && SERIOUS.includes(mood);
  if (prefs.cheeky && !serious) {
    const n = state.replies;
    if (state.fartsThisSession < FART_MAX_PER_VISIT && n >= FART_MIN_REPLIES && n - state.lastFart >= FART_MIN_GAP && rng() < FART_CHANCE) return "fart";
    if (n - state.lastBurp >= BURP_MIN_GAP && rng() < BURP_CHANCE) return "burp";
  }
  if (mood === "crisis") return null;
  if (!serious && LAUGHY.test(text) && rng() < LAUGH_CHANCE) return "laugh";
  if (SIGHY.test(text.trim()) && rng() < SIGH_CHANCE) return "sigh";
  return rng() < BREATH_CHANCE ? "breath" : null;
}

/**
 * Picks which sentences get a soft breath before them, so longer replies sound
 * like a person pausing for air. Never before the first sentence, at least two
 * sentences between breaths, and none in a crisis or with human sounds off.
 */
export function planMidReplyBreaths(sentenceCount: number, prefs: HumanSoundPrefs, mood: Mood | null = null, rng: () => number = Math.random): Set<number> {
  const at = new Set<number>();
  if (!prefs.human || mood === "crisis") return at;
  let since = 0;
  for (let i = 1; i < sentenceCount; i++) {
    since++;
    if (since >= MID_BREATH_MIN_SENTENCES && rng() < MID_BREATH_CHANCE) { at.add(i); since = 0; }
  }
  return at;
}

/** After a fart (always) or a burp (sometimes) she gives a nervous little giggle. */
export function wantsNervousGiggle(kind: HumanSoundKind | null, rng: () => number = Math.random): boolean {
  if (kind === "fart") return true;
  return kind === "burp" && rng() < 0.4;
}

/** Records a reply (and its sound) so gaps between burps/farts are kept. */
export function nextSoundState(state: HumanSoundState, kind: HumanSoundKind | null): HumanSoundState {
  const replies = state.replies + 1;
  return {
    replies,
    lastBurp: kind === "burp" ? state.replies : state.lastBurp,
    lastFart: kind === "fart" ? state.replies : state.lastFart,
    fartsThisSession: state.fartsThisSession + (kind === "fart" ? 1 : 0),
  };
}

const FART_SORRY = [
  "Oh my goodness — excuse me! That was not me. Okay… it was me.",
  "Oops! Pardon me… I'm so embarrassed right now.",
  "Oh no. Excuse me! Let's just pretend that never happened.",
  "Whoops — pardon me! Blame the lamingtons.",
];
const BURP_SORRY = ["Oh! Pardon me.", "Excuse me!", "Oops, pardon me."];

/** Short embarrassed line spoken after a burp (most of the time) or fart (always). */
export function embarrassedLine(kind: HumanSoundKind | null, rng: () => number = Math.random): string | null {
  if (kind === "fart") return FART_SORRY[Math.floor(rng() * FART_SORRY.length)];
  if (kind === "burp" && rng() < 0.7) return BURP_SORRY[Math.floor(rng() * BURP_SORRY.length)];
  return null;
}

const FILES = import.meta.glob("../assets/oracle-sounds/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/** Picks a clip that matches Oracle's look (woman, man or androgynous voice). */
export function humanSoundUrl(kind: HumanSoundKind, gender: LookGender = "woman", rng: () => number = Math.random): string | null {
  const prefix = kind === "fart" ? "fart-" : `${gender}-${kind}-`;
  const urls = Object.entries(FILES).filter(([path]) => path.split("/").pop()!.startsWith(prefix)).map(([, url]) => url);
  return urls.length ? urls[Math.floor(rng() * urls.length)] : null;
}

const PREFS_KEY = (userId?: string) => `oracle-human-sounds:v1:${userId || "anon"}`;
export function loadSoundPrefs(userId?: string): HumanSoundPrefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY(userId)) || "{}") }; } catch { return DEFAULT_PREFS; }
}
export function saveSoundPrefs(userId: string | undefined, prefs: HumanSoundPrefs) {
  try { localStorage.setItem(PREFS_KEY(userId), JSON.stringify(prefs)); } catch { /* storage full or blocked */ }
}

/** Plays one clip and resolves when it ends (or after a safety timeout). A small random
 *  speed change keeps repeated clips from sounding identical. */
export function playHumanSound(url: string, isLive: () => boolean, opts: { volume?: number; vary?: boolean } = {}): Promise<void> {
  return new Promise(resolve => {
    if (!isLive()) return resolve();
    const audio = new Audio(url);
    audio.volume = Math.min(1, Math.max(0, opts.volume ?? 1));
    if (opts.vary !== false) { audio.playbackRate = 0.92 + Math.random() * 0.16; (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false; }
    let done = false;
    const finish = () => { if (done) return; done = true; clearInterval(watch); clearTimeout(cap); audio.pause(); resolve(); };
    const watch = setInterval(() => { if (!isLive()) finish(); }, 100);
    const cap = setTimeout(finish, 4500);
    audio.onended = finish; audio.onerror = finish;
    audio.play().catch(finish);
  });
}
