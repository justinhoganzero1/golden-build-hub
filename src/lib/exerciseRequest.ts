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

/** Only exercise video commands are intercepted; ordinary chat stays with Oracle. */
export function parseFitnessVideoQuery(text: string): string | null {
  const known = parseExerciseRequest(text);
  if (known) return { squat: "squats", pushup: "push ups", jumping_jack: "jumping jacks" }[known];
  const t = text.toLowerCase().replace(/[-_]/g, " ");
  if (!/\b(show|video|watch|play|teach|learn|tutorial|how to)\b/.test(t)) return null;
  const exercise = t.match(/\b(lunges?|planks?|burpees?|sit ups?|crunches?|bench press|bicep curls?|deadlifts?|mountain climbers?|high knees|calf raises?|leg raises?|tricep dips?|yoga|pilates|stretching|wall sits?|shoulder press|glute bridges?|bird dogs?|side planks?)\b/)?.[0];
  if (exercise) return exercise;
  const explicit = t.match(/(?:video|tutorial|demonstration)\s+(?:of|for|on)\s+(?:the\s+)?([a-z ]{2,60}?)\s+exercise\b/)?.[1];
  return explicit?.trim() || null;
}
