// Newsroom host template — pure geometry and camera planning (tested by Vitest).
// The studio is a fixed 1280×720 scene: a silent looping background (staff moving at
// their desks), a wall screen, the host composited behind the anchor desk, and a desk
// layer drawn over her. The "camera" is a crop of that scene that eases between shots.
import type { HostFormat, TimedLine } from "@/lib/youtubeHost";

export interface Rect { x: number; y: number; w: number; h: number }
export type NewsroomShot = "wide" | "host" | "two" | "screen" | "guest";
/** "solo": the host alone at the desk. "interview": host and a reporter side by side. */
export type NewsroomLayout = "solo" | "interview";

export const SCENE = { width: 1280, height: 720 } as const;
/** The green wall screen in scene pixels (measured from the studio loop). */
export const SCREEN_RECT: Rect = { x: 618, y: 70, w: 376, h: 216 };
/** Where the desk layer (desk-overlay image) is drawn over the host. */
export const DESK_RECT: Rect = { x: 40, y: 330, w: 840, h: 320 };
/** Host placement: centre line, top of head area, and height of a waist-up picture. */
export const HOST_ANCHOR = { cx: 457, top: 97, height: 327 } as const;

/** In an interview the host slides left along the desk and the reporter stands to her right. */
export const INTERVIEW_ANCHOR = { hostCx: 290, guestCx: 555 } as const;

export function hostRect(aspect: number, cx: number = HOST_ANCHOR.cx): Rect {
  const a = aspect > 0.2 && aspect < 3 ? aspect : 720 / 1349;
  const w = HOST_ANCHOR.height * a;
  return { x: cx - w / 2, y: HOST_ANCHOR.top, w, h: HOST_ANCHOR.height };
}

const WIDE: Record<HostFormat, Rect> = {
  youtube: { x: 0, y: 0, w: 1280, h: 720 },
  shorts: { x: 255, y: 0, w: 405, h: 720 },
};
const HOST: Record<HostFormat, Rect> = {
  youtube: { x: 217, y: 65, w: 480, h: 270 },
  shorts: { x: 322, y: 0, w: 270, h: 480 },
};
const TWO: Record<HostFormat, Rect> = {
  youtube: { x: 330, y: 20, w: 720, h: 405 },
  shorts: WIDE.shorts,
};
const SCREEN: Record<HostFormat, Rect> = {
  youtube: { x: 596, y: 60, w: 420, h: 236.25 },
  shorts: { x: 603.5, y: 0, w: 405, h: 720 },
};

const closeOn = (cx: number, format: HostFormat): Rect =>
  format === "youtube" ? { x: cx - 240, y: 65, w: 480, h: 270 } : { x: cx - 135, y: 0, w: 270, h: 480 };
const INTERVIEW_TWO: Record<HostFormat, Rect> = {
  youtube: { x: 60, y: 20, w: 720, h: 405 },
  shorts: { x: 220, y: 0, w: 405, h: 720 },
};

export function shotRect(shot: NewsroomShot, format: HostFormat, layout: NewsroomLayout = "solo"): Rect {
  if (layout === "interview") {
    if (shot === "host") return closeOn(INTERVIEW_ANCHOR.hostCx, format);
    if (shot === "guest") return closeOn(INTERVIEW_ANCHOR.guestCx, format);
    if (shot === "two") return INTERVIEW_TWO[format];
  }
  if (shot === "host" || shot === "guest") return HOST[format];
  if (shot === "two") return TWO[format];
  if (shot === "screen") return SCREEN[format];
  return WIDE[format];
}

export interface ShotSegment { shot: NewsroomShot; start: number; end: number; beat: number }

const PATTERN: NewsroomShot[] = ["host", "screen", "host", "two"];
export const MIN_SHOT_SECONDS = 2.5;

/**
 * Opens wide, then cycles close-up → screen → close-up → two-shot like a news bulletin,
 * and signs off wide. Short shots merge into the one before so the camera never jitters.
 */
export function planShots(lines: TimedLine[], beatCount: number): ShotSegment[] {
  if (!lines.length) return [];
  const beats = Math.max(1, beatCount);
  const total = lines[lines.length - 1].end;
  const raw: ShotSegment[] = lines.map((l, i) => {
    const last = i === lines.length - 1 && lines.length >= 4;
    const shot: NewsroomShot = i === 0 || last ? "wide" : PATTERN[(i - 1) % PATTERN.length];
    const beat = Math.min(beats - 1, Math.floor((l.start / (total || 1)) * beats));
    return { shot, start: l.start, end: l.end, beat };
  });
  const merged: ShotSegment[] = [];
  for (const seg of raw) {
    const prev = merged[merged.length - 1];
    if (prev && (prev.shot === seg.shot || seg.end - seg.start < MIN_SHOT_SECONDS)) prev.end = seg.end;
    else merged.push({ ...seg });
  }
  return merged;
}

export type Speaker = "host" | "reporter";
export interface SpokenLine extends TimedLine { speaker: Speaker }

/**
 * Interview camera: opens wide, holds on whoever is talking, shows the wall screen
 * while the reporter explains, cuts to a two-shot when they hand over, signs off wide.
 */
export function planInterviewShots(lines: SpokenLine[], beatCount: number): ShotSegment[] {
  if (!lines.length) return [];
  const beats = Math.max(1, beatCount);
  const total = lines[lines.length - 1].end;
  let handovers = 0;
  let reporterRun = 0;
  const raw: ShotSegment[] = lines.map((l, i) => {
    const prev = lines[i - 1];
    const last = i === lines.length - 1 && lines.length >= 4;
    let shot: NewsroomShot;
    if (i === 0 || last) shot = "wide";
    else if (prev && prev.speaker !== l.speaker && ++handovers % 3 === 0) shot = "two";
    else if (l.speaker === "host") shot = "host";
    else shot = reporterRun++ % 2 === 0 ? "guest" : "screen";
    if (l.speaker === "host") reporterRun = 0;
    const beat = Math.min(beats - 1, Math.floor((l.start / (total || 1)) * beats));
    return { shot, start: l.start, end: l.end, beat };
  });
  const merged: ShotSegment[] = [];
  for (const seg of raw) {
    const prev = merged[merged.length - 1];
    if (prev && (prev.shot === seg.shot || seg.end - seg.start < MIN_SHOT_SECONDS)) prev.end = seg.end;
    else merged.push({ ...seg });
  }
  return merged;
}

export function segmentAt(segments: ShotSegment[], t: number): number {
  for (let i = 0; i < segments.length; i++) if (t < segments[i].end) return i;
  return segments.length - 1;
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const lerp = (a: Rect, b: Rect, p: number): Rect => ({
  x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p,
});
export const CAMERA_MOVE_SECONDS = 1.1;

/** Camera crop at time t: eases from the previous shot, then pushes in very slowly. */
export function cameraAt(segments: ShotSegment[], t: number, format: HostFormat, layout: NewsroomLayout = "solo"): Rect {
  if (!segments.length) return shotRect("wide", format, layout);
  const i = segmentAt(segments, t);
  const seg = segments[i];
  const target = shotRect(seg.shot, format, layout);
  const from = i > 0 ? shotRect(segments[i - 1].shot, format, layout) : target;
  const p = ease(Math.min(1, Math.max(0, (t - seg.start) / CAMERA_MOVE_SECONDS)));
  const base = lerp(from, target, p);
  const push = 1 - Math.min(0.03, Math.max(0, t - seg.start - CAMERA_MOVE_SECONDS) * 0.004);
  const w = base.w * push, h = base.h * push;
  return { x: base.x + (base.w - w) / 2, y: base.y + (base.h - h) / 2, w, h };
}
