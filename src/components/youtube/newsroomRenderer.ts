// Draws one frame of the newsroom template onto a canvas.
// Layers (back to front): studio loop → wall screen content → host (green keyed) → desk → lower third.
import { DESK_RECT, SCENE, SCREEN_RECT, hostRect, type Rect } from "@/lib/newsroomScene";
import { wrapText } from "@/lib/youtubeHost";

/** Removes a green-screen background, softening edges and stripping green spill. */
export class ChromaKeyer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  constructor(width = 480) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = Math.round(width * 1.875);
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }
  key(source: CanvasImageSource, aspect: number): HTMLCanvasElement {
    const w = this.canvas.width;
    const h = Math.max(1, Math.round(w / (aspect || 0.53)));
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(source, 0, 0, w, h);
    let img: ImageData;
    try { img = this.ctx.getImageData(0, 0, w, h); } catch { return this.canvas; }
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const m = r > b ? r : b;
      const diff = g - m;
      if (diff > 20) {
        const a = 1 - (diff - 20) / 60;
        d[i + 3] = a <= 0 ? 0 : Math.round(a * 255);
      }
      if (g > m + 6) d[i + 1] = m + 6;
    }
    this.ctx.putImageData(img, 0, 0);
    return this.canvas;
  }
}

export type ScreenItem =
  | { kind: "text"; title: string }
  | { kind: "image"; title: string; img: HTMLImageElement }
  | { kind: "video"; title: string; video: HTMLVideoElement };

export interface NewsroomFrame {
  t: number;
  camera: Rect;
  bg: CanvasImageSource | null;
  desk: HTMLImageElement | null;
  host: CanvasImageSource | null;
  hostAspect: number;
  /** 0..1 voice loudness, used for gentle movement when the host isn't lip-synced. */
  level: number;
  lipSynced: boolean;
  screen: ScreenItem;
  showName: string;
  anchorName: string;
  headline: string;
  caption: string | null;
  colors: { gold: string; fg: string; bg: string; shade: string; teal: string };
}

function cover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, r: Rect) {
  if (!sw || !sh) return;
  const s = Math.max(r.w / sw, r.h / sh);
  const w = sw * s, h = sh * s;
  ctx.drawImage(src, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

function drawScreen(ctx: CanvasRenderingContext2D, f: NewsroomFrame) {
  const r = SCREEN_RECT;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6); ctx.clip();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, f.colors.bg); g.addColorStop(1, f.colors.shade);
  ctx.fillStyle = g; ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  const item = f.screen;
  if (item.kind === "image") cover(ctx, item.img, item.img.naturalWidth, item.img.naturalHeight, r);
  if (item.kind === "video" && item.video.readyState >= 2) cover(ctx, item.video, item.video.videoWidth, item.video.videoHeight, r);
  // Headline ribbon along the bottom of the screen (the whole card for text items).
  const isText = item.kind === "text";
  ctx.fillStyle = f.colors.gold;
  ctx.font = `700 ${isText ? 26 : 14}px Georgia, serif`;
  const lines = wrapText(item.title || f.showName, r.w - 40, (s) => ctx.measureText(s).width, isText ? 3 : 1);
  if (isText) {
    ctx.fillStyle = f.colors.teal; ctx.fillRect(r.x + 20, r.y + 24, 46, 3);
    ctx.fillStyle = f.colors.fg; ctx.font = `600 11px system-ui, sans-serif`;
    ctx.fillText((f.showName || "Tonight").toUpperCase(), r.x + 20, r.y + 46);
    ctx.fillStyle = f.colors.gold; ctx.font = `700 26px Georgia, serif`;
    lines.forEach((l, i) => ctx.fillText(l, r.x + 20, r.y + 86 + i * 32));
  } else if (lines[0]) {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(r.x, r.y + r.h - 28, r.w, 28);
    ctx.fillStyle = f.colors.gold; ctx.fillText(lines[0], r.x + 12, r.y + r.h - 9);
  }
  // Soft screen glow.
  const glow = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  glow.addColorStop(0, "rgba(255,255,255,0.06)"); glow.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = glow; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

export function drawNewsroom(ctx: CanvasRenderingContext2D, f: NewsroomFrame) {
  const { width, height } = ctx.canvas;
  const scale = width / f.camera.w;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, -f.camera.x * scale, -f.camera.y * scale);
  if (f.bg) ctx.drawImage(f.bg, 0, 0, SCENE.width, SCENE.height);
  else { ctx.fillStyle = f.colors.bg; ctx.fillRect(0, 0, SCENE.width, SCENE.height); }
  drawScreen(ctx, f);
  if (f.host) {
    const hr = hostRect(f.hostAspect);
    // A still photo breathes and sways a little with the voice; a lip-synced clip moves by itself.
    const sway = f.lipSynced ? 0 : Math.sin(f.t * 0.7) * 1.2 + Math.sin(f.t * 2.1) * f.level * 1.5;
    const breathe = f.lipSynced ? 1 : 1 + Math.sin(f.t * 1.6) * 0.004 + f.level * 0.006;
    const w = hr.w * breathe, h = hr.h * breathe;
    ctx.drawImage(f.host, hr.x + sway - (w - hr.w) / 2, hr.y - (h - hr.h), w, h);
  }
  if (f.desk) ctx.drawImage(f.desk, DESK_RECT.x, DESK_RECT.y, DESK_RECT.w, DESK_RECT.h);
  ctx.restore();

  // Lower third + captions sit on top of the picture, not in the studio.
  const tall = height > width;
  const u = width / (tall ? 720 : 1280);
  const barY = height - (tall ? 300 : 120) * u;
  ctx.fillStyle = f.colors.gold; ctx.fillRect(40 * u, barY, 8 * u, 64 * u);
  ctx.fillStyle = "rgba(10,12,16,0.82)"; ctx.fillRect(48 * u, barY, (tall ? 600 : 700) * u, 64 * u);
  ctx.fillStyle = f.colors.gold; ctx.font = `700 ${22 * u}px Georgia, serif`;
  const top = wrapText(f.headline || f.showName || "Tonight", (tall ? 560 : 660) * u, (s) => ctx.measureText(s).width, 1)[0] || "";
  ctx.fillText(top, 64 * u, barY + 28 * u);
  ctx.fillStyle = f.colors.fg; ctx.font = `500 ${16 * u}px system-ui, sans-serif`;
  ctx.fillText([f.anchorName, f.showName].filter(Boolean).join(" · "), 64 * u, barY + 52 * u);
  ctx.fillStyle = "#c62828"; ctx.fillRect(40 * u, 36 * u, 64 * u, 26 * u);
  ctx.fillStyle = "#ffffff"; ctx.font = `700 ${15 * u}px system-ui, sans-serif`; ctx.fillText("LIVE", 54 * u, 55 * u);

  if (f.caption) {
    ctx.font = `700 ${(tall ? 34 : 30) * u}px system-ui, sans-serif`;
    const ls = wrapText(f.caption, width - 120 * u, (s) => ctx.measureText(s).width, 2);
    const lh = (tall ? 44 : 38) * u;
    const boxTop = barY - ls.length * lh - 40 * u;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(40 * u, boxTop, width - 80 * u, ls.length * lh + 20 * u);
    ctx.fillStyle = "#ffffff";
    ls.forEach((l, i) => ctx.fillText(l, 60 * u, boxTop + 10 * u + (i + 0.8) * lh));
  }
}
