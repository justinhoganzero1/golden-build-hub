// ============================================
// MOVIE HOST — talking-head presenter layer
// ============================================
// A movable, lip-synced on-camera host that can be composited over any scene
// of a movie, plus short (max 8s) two-avatar interview beats where the host
// "talks" live to a character from the film.
//
// Lip-sync is procedural: we sample an RMS envelope from the host's TTS audio
// and drive a jaw-stretch + mouth-shape overlay from it, so it stays perfectly
// in sync with the exact audio buffer that gets rendered into the export.
// ============================================

/** Hard cap on an interview exchange, per product spec. */
export const MAX_INTERVIEW_SEC = 8;

export interface HostConfig {
  enabled: boolean;
  name: string;
  title: string;
  /** Portrait / desk shot of the presenter (data URL or signed URL). */
  imageUrl: string | null;
  voiceId: string;
  /** Position of the host card, as a fraction of the frame (top-left corner). */
  x: number;
  y: number;
  /** Card width as a fraction of frame width. */
  scale: number;
  /** Where the mouth sits inside the portrait, as a fraction of the card. */
  mouthX: number;
  mouthY: number;
  /** Show the name/title lower third under the host card. */
  showPlate: boolean;
  /** Frame styling. */
  frame: "rounded" | "circle" | "square";
}

export const DEFAULT_HOST: HostConfig = {
  enabled: false,
  name: "Ava Lune",
  title: "Oracle Lunar News",
  imageUrl: null,
  voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah
  x: 0.68,
  y: 0.5,
  scale: 0.28,
  mouthX: 0.5,
  mouthY: 0.68,
  showPlate: true,
  frame: "rounded",
};

export const HOST_POSITION_PRESETS: Array<{ id: string; label: string; x: number; y: number; scale: number }> = [
  { id: "br", label: "Bottom right", x: 0.68, y: 0.5, scale: 0.28 },
  { id: "bl", label: "Bottom left", x: 0.04, y: 0.5, scale: 0.28 },
  { id: "tr", label: "Top right", x: 0.68, y: 0.05, scale: 0.26 },
  { id: "tl", label: "Top left", x: 0.04, y: 0.05, scale: 0.26 },
  { id: "center", label: "Centre (full anchor)", x: 0.3, y: 0.18, scale: 0.4 },
  { id: "desk", label: "Newsdesk (large left)", x: 0.03, y: 0.32, scale: 0.42 },
];

/** A host piece-to-camera dropped on top of one scene. */
export interface HostBeat {
  line: string;
  audio_url?: string;
  /** Seconds into the scene where the host appears. */
  offset_sec: number;
  /** Per-beat position override (falls back to the global host config). */
  x?: number;
  y?: number;
  scale?: number;
  generating?: boolean;
}

/** A ≤8s two-avatar exchange: host asks, guest answers. */
export interface InterviewBeat {
  guestName: string;
  guestImageUrl: string | null;
  guestVoiceId: string;
  hostLine: string;
  guestLine: string;
  hostAudioUrl?: string;
  guestAudioUrl?: string;
  offset_sec: number;
  /** Total on-screen length, clamped to MAX_INTERVIEW_SEC. */
  seconds: number;
  generating?: boolean;
}

export const clampInterviewSeconds = (n: number) =>
  Math.max(2, Math.min(MAX_INTERVIEW_SEC, Math.round(n || MAX_INTERVIEW_SEC)));

// ---------------------------------------------------------------------------
// Lip-sync envelope
// ---------------------------------------------------------------------------

/**
 * Build a per-frame loudness envelope (0..1) from an AudioBuffer.
 * The result drives mouth openness, so the host's jaw moves exactly with the
 * audio that is being recorded into the export.
 */
export function audioEnvelope(buffer: AudioBuffer, fps = 30): Float32Array {
  const data = buffer.getChannelData(0);
  const frames = Math.max(1, Math.ceil(buffer.duration * fps));
  const per = Math.max(1, Math.floor(data.length / frames));
  const out = new Float32Array(frames);
  let peak = 0.0001;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * per;
    const end = Math.min(data.length, start + per);
    for (let i = start; i < end; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    out[f] = rms;
    if (rms > peak) peak = rms;
  }
  // Normalise and apply a light curve so quiet consonants still move the mouth.
  for (let f = 0; f < frames; f++) out[f] = Math.min(1, Math.pow(out[f] / peak, 0.6));
  return out;
}

/** Read the envelope at a time in seconds (0 when silent / out of range). */
export function envelopeAt(env: Float32Array | null, seconds: number, fps = 30): number {
  if (!env || seconds < 0) return 0;
  const i = Math.floor(seconds * fps);
  if (i < 0 || i >= env.length) return 0;
  // Small smoothing window avoids jitter between frames.
  const a = env[i];
  const b = env[Math.min(env.length - 1, i + 1)];
  return (a * 0.7 + b * 0.3);
}

// ---------------------------------------------------------------------------
// Canvas drawing
// ---------------------------------------------------------------------------

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export interface TalkingHeadDraw {
  img: CanvasImageSource;
  /** Card rect in device pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..1 mouth openness for this frame. */
  level: number;
  /** Mouth anchor inside the card (fractions). */
  mouthX: number;
  mouthY: number;
  frame?: HostConfig["frame"];
  name?: string;
  title?: string;
  /** Mirror the head so two avatars can face each other. */
  flip?: boolean;
  /** Seconds elapsed — used for idle breathing / sway. */
  time?: number;
  /** Highlight ring while this avatar is the one speaking. */
  speaking?: boolean;
}

/**
 * Draw one lip-synced talking head. Called every frame of the export/preview
 * loop; safe to call for two heads at once (interview mode).
 */
export function drawTalkingHead(ctx: CanvasRenderingContext2D, o: TalkingHeadDraw) {
  const { x, y, w, h } = o;
  const t = o.time ?? 0;
  const level = Math.max(0, Math.min(1, o.level));
  const gold = "hsl(45 90% 60%)";

  ctx.save();

  // Drop shadow so the host reads as a deliberate overlay, not part of the plate.
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = w * 0.08;
  ctx.shadowOffsetY = h * 0.02;

  // Clip to the chosen frame shape
  if (o.frame === "circle") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else if (o.frame === "square") {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  } else {
    roundRectPath(ctx, x, y, w, h, w * 0.08);
  }
  ctx.fillStyle = "#05070c";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();

  // Idle life: gentle breathing + sway, amplified while speaking.
  const breathe = Math.sin(t * 1.6) * 0.006;
  const sway = Math.sin(t * 0.9) * w * 0.006;
  const jaw = 1 + level * 0.035 + breathe;

  ctx.save();
  ctx.translate(x + w / 2 + sway, y + h);
  if (o.flip) ctx.scale(-1, 1);
  ctx.scale(1, jaw);
  ctx.drawImage(o.img, -w / 2, -h, w, h);
  ctx.restore();

  // Mouth overlay — an opening jaw shape anchored on the portrait's mouth.
  if (level > 0.04) {
    const mx = x + w * (o.flip ? 1 - o.mouthX : o.mouthX) + sway;
    const my = y + h * o.mouthY;
    const mw = w * 0.11 * (0.75 + level * 0.5);
    const mh = h * 0.055 * level;
    ctx.globalAlpha = Math.min(0.85, 0.35 + level * 0.6);
    ctx.fillStyle = "rgba(28,10,14,0.9)";
    ctx.beginPath();
    ctx.ellipse(mx, my, mw, mh, 0, 0, Math.PI * 2);
    ctx.fill();
    // Teeth highlight on wide vowels
    if (level > 0.55) {
      ctx.globalAlpha = (level - 0.55) * 1.2;
      ctx.fillStyle = "rgba(255,250,240,0.75)";
      ctx.beginPath();
      ctx.ellipse(mx, my - mh * 0.45, mw * 0.8, mh * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Frame ring — brighter while this head is speaking.
  ctx.save();
  ctx.strokeStyle = o.speaking ? gold : "rgba(255,255,255,0.25)";
  ctx.lineWidth = Math.max(2, w * (o.speaking ? 0.012 : 0.006));
  if (o.frame === "circle") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (o.frame === "square") {
    ctx.strokeRect(x, y, w, h);
  } else {
    roundRectPath(ctx, x, y, w, h, w * 0.08);
    ctx.stroke();
  }
  ctx.restore();

  // Name plate under the card
  if (o.name) {
    const plateH = Math.max(26, h * 0.13);
    const plateY = y + h + h * 0.02;
    ctx.save();
    ctx.fillStyle = "rgba(4,6,12,0.82)";
    roundRectPath(ctx, x, plateY, w, plateH, plateH * 0.22);
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.fillRect(x, plateY, Math.max(3, w * 0.012), plateH);
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(plateH * 0.42)}px sans-serif`;
    ctx.fillText(o.name, x + w * 0.05, plateY + plateH * 0.45);
    if (o.title) {
      ctx.fillStyle = "hsl(45 90% 70%)";
      ctx.font = `${Math.round(plateH * 0.3)}px sans-serif`;
      ctx.fillText(o.title, x + w * 0.05, plateY + plateH * 0.8);
    }
    ctx.restore();
  }
}

/** Card geometry from fractional config for a given canvas size. */
export function hostRect(
  canvasW: number,
  canvasH: number,
  cfg: { x: number; y: number; scale: number },
) {
  const w = Math.round(canvasW * Math.max(0.08, Math.min(0.7, cfg.scale)));
  const h = Math.round(w * 1.25);
  return {
    x: Math.round(canvasW * Math.max(0, Math.min(1, cfg.x))),
    y: Math.round(canvasH * Math.max(0, Math.min(1, cfg.y))),
    w,
    h,
  };
}

/** Prompt used when Oracle generates the presenter's on-camera look. */
export function hostPortraitPrompt(name: string, title: string, look: string) {
  return `${look || "Professional television news presenter"} named ${name}. Head-and-shoulders shot behind a modern newsroom desk, presenter looking directly into the camera, mouth closed and relaxed, neutral confident expression, studio key lighting, softly blurred newsroom background with screens, photorealistic 4K, sharp focus, entire head fully inside the frame with generous headroom, no text, no captions, no watermark.`;
}
