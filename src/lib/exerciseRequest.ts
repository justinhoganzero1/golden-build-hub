import type { Exercise } from "@/lib/fitnessForm";
/** Reads "show me a video of star jumps" style requests; returns the how-to clip to play. */
export function parseExerciseRequest(text: string): Exercise | null {
  const t = text.toLowerCase();
  const ex: Exercise | null = /\b(star\s*-?\s*jumps?|jumping\s*-?\s*jacks?)\b/.test(t) ? "jumping_jack"
    : /\b(push\s*-?\s*ups?|press\s*-?\s*ups?)\b/.test(t) ? "pushup"
    : /\bsquats?\b/.test(t) ? "squat" : null;
  if (!ex) return null;
  return /\b(show|video|clip|watch|play|demo\w*|how\s+(?:do|to)|teach|learn|see|tutorial)\b/.test(t) ? ex : null;
}
