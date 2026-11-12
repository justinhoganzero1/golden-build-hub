export const PRODUCTION_STAGES = [
  { at: 0, label: "Setting up the scene and camera" },
  { at: 25, label: "Matching voice and expression" },
  { at: 60, label: "Polishing the final video" },
  { at: 120, label: "Almost there — finishing touches" },
] as const;

/** Stage index for elapsed seconds; estimated by time, not real server progress. */
export function productionStage(elapsedSec: number): number {
  let i = 0;
  PRODUCTION_STAGES.forEach((s, idx) => { if (elapsedSec >= s.at) i = idx; });
  return i;
}

/** Estimated percent; never reaches 100 until the video actually arrives. */
export function productionPercent(elapsedSec: number, expectedSec = 120): number {
  return Math.min(95, Math.round((1 - Math.exp(-elapsedSec / (expectedSec / 2))) * 100));
}

export const welcomeKey = (userId: string) => `oracle-welcome-seen:${userId}`;
