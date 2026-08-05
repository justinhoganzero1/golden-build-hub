/**
 * Video resilience ladder — 59 automatic fallbacks.
 *
 * Problem: long AI-rendered MP4s stall mid-playback (slow storage range
 * requests, expired signed URLs, background tab throttling, mobile power
 * saving, decoder hiccups). The user then has to keep tapping play.
 *
 * This module gives every <video> in the app a self-healing recovery ladder:
 * whenever playback stops without the user asking for it, the next fallback
 * in the ladder fires automatically. Each step escalates, and the ladder
 * cycles so playback keeps trying for as long as the video is on screen.
 */

export type FallbackKind =
  | "resume"          // just call play() again
  | "nudge"           // seek a hair forward, then play
  | "buffer-seek"     // jump to the end of the buffered range
  | "reload-src"      // re-set src and seek back to position
  | "resign"          // ask the owner for a fresh (signed) URL
  | "muted-resume"    // drop audio so autoplay policy can't block us
  | "preload-all"     // switch preload to auto and reload
  | "back-off"        // wait longer, then resume
  | "low-quality";    // last resort: disable remote playback / pip and retry

export interface FallbackStep {
  /** 1-based position in the ladder. */
  index: number;
  kind: FallbackKind;
  /** How long to wait before firing this step (ms). */
  delayMs: number;
  /** Seconds to nudge the playhead forward, when relevant. */
  nudge: number;
  label: string;
}

/**
 * Build the 59-step ladder. Early steps are instant and cheap, later steps
 * are heavier and slower, so a brief network blip never costs the viewer a
 * reload while a genuinely broken stream still gets fully rebuilt.
 */
function buildLadder(): FallbackStep[] {
  const plan: Array<[FallbackKind, number, number]> = [
    // 1-12: instant, invisible recovery
    ...Array.from({ length: 6 }, () => ["resume", 120, 0] as [FallbackKind, number, number]),
    ...Array.from({ length: 6 }, () => ["nudge", 200, 0.05] as [FallbackKind, number, number]),
    // 13-22: skip over the stall using what is already buffered
    ...Array.from({ length: 10 }, () => ["buffer-seek", 300, 0.25] as [FallbackKind, number, number]),
    // 23-30: autoplay-policy escape hatch
    ...Array.from({ length: 8 }, () => ["muted-resume", 350, 0] as [FallbackKind, number, number]),
    // 31-38: force the browser to fetch the whole file
    ...Array.from({ length: 8 }, () => ["preload-all", 500, 0] as [FallbackKind, number, number]),
    // 39-46: rebuild the element source at the same timestamp
    ...Array.from({ length: 8 }, () => ["reload-src", 700, 0] as [FallbackKind, number, number]),
    // 47-53: mint a brand-new signed/refreshed URL
    ...Array.from({ length: 7 }, () => ["resign", 900, 0] as [FallbackKind, number, number]),
    // 54-57: patient back-off for congested networks
    ...Array.from({ length: 4 }, () => ["back-off", 2000, 0] as [FallbackKind, number, number]),
    // 58-59: strip everything that can block the decoder
    ...Array.from({ length: 2 }, () => ["low-quality", 2500, 0] as [FallbackKind, number, number]),
  ];

  return plan.slice(0, 59).map(([kind, delayMs, nudge], i) => ({
    index: i + 1,
    kind,
    // Gentle escalation inside each band so we never hammer the network.
    delayMs: delayMs + Math.floor(i / 6) * 60,
    nudge,
    label: `${i + 1}/59 · ${kind}`,
  }));
}

export const VIDEO_FALLBACKS: FallbackStep[] = buildLadder();
export const VIDEO_FALLBACK_COUNT = VIDEO_FALLBACKS.length; // 59

/** Step for an attempt number, cycling through the ladder forever. */
export function fallbackFor(attempt: number): FallbackStep {
  return VIDEO_FALLBACKS[attempt % VIDEO_FALLBACK_COUNT];
}
