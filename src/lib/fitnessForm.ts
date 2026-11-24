// Free on-device workout tracking: rep counting and form tips from body landmarks (MediaPipe pose indexes).
export type Pt = { x: number; y: number; visibility?: number };
export type Exercise = "squat" | "pushup" | "jumping_jack";

export function angle(a: Pt, b: Pt, c: Pt): number {
  const r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let d = Math.abs((r * 180) / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

export const EXERCISES: Record<Exercise, { label: string; youtube: string; down: number; up: number }> = {
  squat: { label: "Squats", youtube: "aclHkVaku9U", down: 100, up: 160 },
  pushup: { label: "Push-ups", youtube: "IODxDxX7oi4", down: 95, up: 155 },
  jumping_jack: { label: "Jumping jacks", youtube: "iSSAk4XCsRA", down: 40, up: 120 },
};

/** Main joint angle for an exercise (knee for squats, elbow for push-ups, shoulder for jacks). */
export function jointAngle(ex: Exercise, lm: Pt[]): number | null {
  const need = (i: number[]) => i.every((k) => lm[k] && (lm[k].visibility ?? 1) > 0.4);
  if (ex === "squat" && need([23, 25, 27])) return angle(lm[23], lm[25], lm[27]);
  if (ex === "pushup" && need([11, 13, 15])) return angle(lm[11], lm[13], lm[15]);
  if (ex === "jumping_jack" && need([23, 11, 13])) return angle(lm[23], lm[11], lm[13]);
  return null;
}

export type RepState = { phase: "up" | "down"; reps: number };

/** Counts one rep each time the joint goes past "down" and returns past "up". */
export function stepReps(ex: Exercise, s: RepState, a: number | null): RepState {
  if (a == null) return s;
  const t = EXERCISES[ex];
  const goingDown = ex === "jumping_jack" ? a > t.up : a < t.down;
  const backUp = ex === "jumping_jack" ? a < t.down : a > t.up;
  if (s.phase === "up" && goingDown) return { ...s, phase: "down" };
  if (s.phase === "down" && backUp) return { phase: "up", reps: s.reps + 1 };
  return s;
}

/** One short correction, or null when form looks fine. */
export function formTip(ex: Exercise, lm: Pt[]): string | null {
  if (ex === "squat" && lm[11] && lm[23] && lm[25]) {
    if (angle(lm[11], lm[23], lm[25]) < 55) return "Chest up — keep your back straighter.";
    if (lm[25] && lm[27] && lm[31] && Math.abs(lm[25].x - lm[27].x) > 0.12) return "Keep your knees over your feet.";
  }
  if (ex === "pushup" && lm[11] && lm[23] && lm[27]) {
    if (angle(lm[11], lm[23], lm[27]) < 150) return "Keep your body in one straight line — hips level.";
  }
  return null;
}
