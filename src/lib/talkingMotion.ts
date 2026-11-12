/**
 * Gentle head-and-shoulder "talking" sway for Oracle's picture while she speaks.
 * Layered slow waves plus small periodic nods; no mouth movement, so it never
 * pretends to be lip-sync. Pure function of time so it is easy to test.
 */
export interface TalkingPose { rotate: number; x: number; y: number; scale: number }

export const TALKING_LIMITS = { rotate: 1.2, x: 4, y: 6 } as const;

export function talkingPose(tSec: number): TalkingPose {
  const nod = Math.max(0, Math.sin(tSec * 4.1)) ** 3; // small emphasis nods
  const rotate = 0.9 * Math.sin(tSec * 1.3) + 0.5 * Math.sin(tSec * 2.7 + 1.1);
  const x = 3 * Math.sin(tSec * 0.9 + 0.4) + 1.5 * Math.sin(tSec * 2.1);
  const y = 2.5 * Math.sin(tSec * 1.7 + 0.8) + 3 * nod;
  return {
    rotate: clamp(rotate, TALKING_LIMITS.rotate),
    x: clamp(x, TALKING_LIMITS.x),
    y: clamp(y, TALKING_LIMITS.y),
    scale: 1.07 + 0.006 * Math.sin(tSec * 1.1),
  };
}

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
export const poseTransform = (p: TalkingPose) => `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) rotate(${p.rotate.toFixed(3)}deg) scale(${p.scale.toFixed(4)})`;
