// Oracle's human sounds: a soft breath, sigh or giggle before she speaks, breaths
// between sentences, the odd burp and an occasional loud fart with a wet, runny tail (followed by an embarrassed blush).
// All sounds are small prerecorded clips played on the device — free, never a
// paid generation — and they respect mute and the member's settings.
import type { Mood } from "@/lib/oracleMood";
import type { LookGender } from "@/lib/oracleLook";

export type HumanSoundKind = "breath" | "sigh" | "laugh" | "burp" | "fart" | "hiccup";
export interface HumanSoundPrefs { human: boolean; cheeky: boolean }
export interface HumanSoundState {
  replies: number; lastBurp: number; lastFart: number; fartsThisSession: number;
  /** When her first reply of this visit played (ms), so the opening burp and fart land early. */
  startedAt: number | null;
  /** The reply she gets her one little hiccup on, and whether it has happened. */
  hiccupAt: number; hiccupped: boolean;
}

/** Opening: a burp on her 2nd reply, then a fart two replies later (sooner once 75s have passed),
 *  so both normally happen in the first two minutes of chatting. */
export const OPENING_MS = 120_000;
export const OPENING_BURP_REPLY = 1;
export const OPENING_FART_AFTER_BURP = 2;
export const OPENING_FART_HURRY_MS = 75_000;
/** After the opening: burp and fart only about once every 2,000 replies, so they stay a rare surprise. */
export const BURP_CHANCE = 1 / 2000;
export const BURP_MIN_GAP = 2000;
export const FART_CHANCE = 1 / 2000;
export const FART_MIN_GAP = 2000;
export const FART_MAX_PER_VISIT = 2;
/** One little hiccup per visit, somewhere between her 6th and 10th reply. */
export const HICCUP_FIRST_REPLY = 5;
export const HICCUP_LAST_REPLY = 9;
/** Chances for the soft sounds before she talks. */
export const LAUGH_CHANCE = 0.75;
export const SIGH_CHANCE = 0.7;
export const BREATH_CHANCE = 0.6;
/** Breaths between sentences of a longer reply (free device voice). */
export const MID_BREATH_CHANCE = 0.45;
export const MID_BREATH_MIN_SENTENCES = 2;

/** Human and cheeky sounds are both on unless the member switches them off. */
export const DEFAULT_PREFS: HumanSoundPrefs = { human: true, cheeky: true };
export const freshSoundState = (rng: () => number = Math.random): HumanSoundState => ({
  replies: 0, lastBurp: -BURP_MIN_GAP, lastFart: -FART_MIN_GAP, fartsThisSession: 0, startedAt: null,
  hiccupAt: HICCUP_FIRST_REPLY + Math.floor(rng() * (HICCUP_LAST_REPLY - HICCUP_FIRST_REPLY + 1)), hiccupped: false,
});

/** Moods where cheeky noises or giggles would feel uncaring. */
const SERIOUS: Mood[] = ["crisis", "sad", "anxious", "angry", "lonely"];
const LAUGHY = /\b(?:haha+|hehe+|lol)\b|😂|🤣|😄|😆|😅|😁/i;
const SIGHY = /^(?:oh+|aw+|ah+|hmm+|phew|well|mmm+)\b|\b(?:that sounds (?:hard|tough|rough)|i'm so sorry|sending (?:you )?love)\b/i;

/** Decides which (if any) sound plays before this reply. Pure, so the rules stay testable. */
export function pickHumanSound(text: string, state: HumanSoundState, prefs: HumanSoundPrefs, mood: Mood | null = null, rng: () => number = Math.random, now: number = Date.now()): HumanSoundKind | null {
  if (!prefs.human || !text.trim()) return null;
  const serious = !!mood && SERIOUS.includes(mood);
  const n = state.replies;
  if (prefs.cheeky && !serious) {
    const burped = state.lastBurp >= 0;
    const farted = state.fartsThisSession > 0;
    const elapsed = state.startedAt === null ? 0 : now - state.startedAt;
    // Opening: one burp and one fart early in the chat, spread a couple of replies apart.
    if (!burped && n >= OPENING_BURP_REPLY) return "burp";
    if (burped && !farted && n > state.lastBurp && (n - state.lastBurp >= OPENING_FART_AFTER_BURP || elapsed >= OPENING_FART_HURRY_MS)) return "fart";
    if (burped && farted) {
      if (state.fartsThisSession < FART_MAX_PER_VISIT && n - state.lastFart >= FART_MIN_GAP && rng() < FART_CHANCE) return "fart";
      if (n - state.lastBurp >= BURP_MIN_GAP && rng() < BURP_CHANCE) return "burp";
    }
  }
  if (mood === "crisis") return null;
  // One little hiccup per visit, never straight after a burp or fart.
  if (!serious && !state.hiccupped && n >= state.hiccupAt && n - state.lastBurp >= 2 && n - state.lastFart >= 2) return "hiccup";
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
export function nextSoundState(state: HumanSoundState, kind: HumanSoundKind | null, now: number = Date.now()): HumanSoundState {
  const replies = state.replies + 1;
  return {
    ...state,
    replies,
    startedAt: state.startedAt ?? now,
    hiccupped: state.hiccupped || kind === "hiccup",
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
export const HICCUP_SORRY = "Sorry, I got the AI hiccups.";

/** Short embarrassed line spoken after a burp (most of the time), a fart or a hiccup (always). */
export function embarrassedLine(kind: HumanSoundKind | null, rng: () => number = Math.random): string | null {
  if (kind === "hiccup") return HICCUP_SORRY;
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
