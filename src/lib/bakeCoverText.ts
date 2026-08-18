// Bake cover typography INTO the artwork pixels.
//
// The image model only ever paints text-free artwork (models spell badly).
// Once the art is baked, this compositor draws the *editable* title, author
// and blurb onto the picture with a real canvas, producing a flattened cover
// image the user can download, export to KDP/EPUB, or send anywhere.

export interface BakeTextOptions {
  slot: "cover" | "back";
  title: string;
  author: string;
  blurb?: string;
  genre?: string;
  /** Long edge of the output image. */
  size?: number;
  /** Exact print dimensions. Defaults to 6x9in plus 0.125in bleed at 300 DPI. */
  width?: number;
  height?: number;
  /** Per-book typography treatment selected from the book identity. */
  layout?: "masthead" | "title-author" | "cinematic" | "editorial";
}

type CoverIdentity = {
  display: string;
  body: string;
  light: string;
  mid: string;
  deep: string;
  accent: string;
};

function coverIdentity(title: string, genre = ""): CoverIdentity {
  const seed = `${title}|${genre}`.split("").reduce((n, c) => ((n * 33) + c.charCodeAt(0)) >>> 0, 11);
  const identities: CoverIdentity[] = [
    { display: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", body: "Helvetica, Arial, sans-serif", light: "#effcff", mid: "#45d6ff", deep: "#0066ff", accent: "#ff315f" },
    { display: "Rockwell, 'Courier New', serif", body: "Georgia, serif", light: "#fff2b8", mid: "#ff8a2a", deep: "#ed1d4f", accent: "#20e0bd" },
    { display: "Palatino Linotype, Book Antiqua, Palatino, serif", body: "Palatino Linotype, serif", light: "#f4f0ff", mid: "#b98cff", deep: "#5e36cf", accent: "#ffcf3f" },
    { display: "Trebuchet MS, Arial, sans-serif", body: "Trebuchet MS, Arial, sans-serif", light: "#f1fff5", mid: "#55e879", deep: "#087f63", accent: "#ff4c8b" },
    { display: "Arial Black, Arial, sans-serif", body: "Arial, sans-serif", light: "#fff7ee", mid: "#ffcf45", deep: "#ef3e23", accent: "#00b8d9" },
  ];
  return identities[seed % identities.length];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the cover artwork"));
    img.src = url;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

/** Shrink font size until the wrapped text fits the given box. */
function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  start: number,
  weight = "700",
  family = "Georgia, 'Times New Roman', serif",
  lineRatio = 1.32,
): { lines: string[]; fontSize: number; lineHeight: number } {
  let fontSize = start;
  for (; fontSize > 8; fontSize -= 1) {
    ctx.font = `${weight} ${fontSize}px ${family}`;
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length * fontSize * lineRatio <= maxHeight) {
      return { lines, fontSize, lineHeight: fontSize * lineRatio };
    }
  }
  ctx.font = `${weight} ${fontSize}px ${family}`;
  return { lines: wrap(ctx, text, maxWidth), fontSize, lineHeight: fontSize * lineRatio };
}

function titleGradient(ctx: CanvasRenderingContext2D, y: number, h: number, identity: CoverIdentity) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, identity.light);
  g.addColorStop(0.5, identity.mid);
  g.addColorStop(1, identity.deep);
  return g;
}

function scrim(ctx: CanvasRenderingContext2D, w: number, y: number, h: number, from: "top" | "bottom") {
  const g = ctx.createLinearGradient(0, from === "top" ? y : y + h, 0, from === "top" ? y + h : y);
  g.addColorStop(0, "rgba(0,0,0,0.92)");
  g.addColorStop(0.6, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Composite the cover typography onto the artwork and return a JPEG data URL.
 */
export async function bakeCoverText(artworkUrl: string, opts: BakeTextOptions): Promise<string> {
  const img = await loadImage(artworkUrl);
  const H = opts.height ?? opts.size ?? 2775;
  const W = opts.width ?? 1875;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable in this browser");

  // Lossless framing: never crop AI artwork during preview or print export.
  // A soft full-bleed backdrop fills any aspect-ratio mismatch, then the entire
  // original is fitted above it. This guarantees the compositor cannot remove
  // a head, face, hand, foot, weapon or other edge detail the agents approved.
  {
    const srcAR = img.width / img.height;
    const dstAR = W / H;
    if (Math.abs(srcAR - dstAR) > 0.002) {
      const backgroundScale = Math.max(W / img.width, H / img.height);
      const backgroundW = img.width * backgroundScale;
      const backgroundH = img.height * backgroundScale;
      ctx.save();
      ctx.filter = `blur(${Math.max(18, W * 0.018)}px) brightness(0.55)`;
      ctx.drawImage(img, (W - backgroundW) / 2, (H - backgroundH) / 2, backgroundW, backgroundH);
      ctx.restore();
    }

    const foregroundScale = Math.min(W / img.width, H / img.height);
    const foregroundW = img.width * foregroundScale;
    const foregroundH = img.height * foregroundScale;
    ctx.drawImage(img, (W - foregroundW) / 2, (H - foregroundH) / 2, foregroundW, foregroundH);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const pad = W * 0.07;
  const inner = W - pad * 2;
  const title = (opts.title || "Untitled").toUpperCase();
  const author = opts.author || "Author";
  const layout = opts.layout ?? "masthead";
  const identity = coverIdentity(title, opts.genre);

  if (opts.slot === "cover") {
    // Bottom-anchored masthead: the hero artwork stays completely unobstructed
    // in the upper two-thirds; title + author sit in the lower band.
    scrim(ctx, W, H * 0.52, H * 0.48, "bottom");

    const t = fitLines(ctx, title, inner, H * 0.22, W * 0.13, "900", identity.display, 1.02);
    const titleBlock = t.lines.length * t.lineHeight;
    const authorSize = W * 0.05;
    const genreSize = W * 0.026;

    const bottomPad = H * 0.055;
    const authorY = H - bottomPad - authorSize * 1.2;
    const ruleY = authorY - W * 0.035;
    const titleY = ruleY - W * 0.03 - titleBlock;
    const genreY = titleY - W * 0.055;

    if (opts.genre) {
      ctx.font = `700 ${genreSize}px ${identity.body}`;
      ctx.fillStyle = identity.accent;
      ctx.fillText(opts.genre.toUpperCase().split("").join(" "), W / 2, genreY);
    }

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = W * 0.02;
    ctx.shadowOffsetY = W * 0.006;
    ctx.fillStyle = titleGradient(ctx, titleY, titleBlock, identity);
    t.lines.forEach((line, i) => ctx.fillText(line, W / 2, titleY + i * t.lineHeight));
    ctx.restore();

    ctx.fillStyle = identity.accent;
    ctx.fillRect(W * 0.33, ruleY, W * 0.34, Math.max(1, W * 0.0018));

    // The author credit is deliberately flexible per book. Keep it as the
    // author's name alone and never duplicate it on the rear.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = W * 0.015;
    ctx.font = `${layout === "cinematic" ? "800" : "700"} ${authorSize}px ${identity.body}`;
    ctx.fillStyle = identity.light;
    ctx.fillText(layout === "editorial" ? author : author.toUpperCase(), W / 2, authorY);
    ctx.restore();
  } else {
    scrim(ctx, W, 0, H * 0.22, "top");

    let y = H * 0.05;
    const t = fitLines(ctx, title, inner, H * 0.12, W * 0.085, "900", identity.display, 1.05);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = W * 0.02;
    ctx.fillStyle = titleGradient(ctx, y, t.lines.length * t.lineHeight, identity);
    t.lines.forEach((line, i) => ctx.fillText(line, W / 2, y + i * t.lineHeight));
    ctx.restore();
    y += t.lines.length * t.lineHeight + W * 0.02;

    // Blurb card
    const blurb = (opts.blurb || "").trim();
    if (blurb) {
      const cardX = pad * 0.7;
      const cardW = W - cardX * 2;
      const cardY = Math.max(y, H * 0.2);
      const cardH = H * 0.6;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      roundRect(ctx, cardX, cardY, cardW, cardH, W * 0.03);
      ctx.fill();
      ctx.strokeStyle = identity.accent;
      ctx.lineWidth = Math.max(1, W * 0.002);
      ctx.stroke();
      ctx.restore();

      const textPad = W * 0.045;
      const b = fitLines(
        ctx, blurb, cardW - textPad * 2, cardH - textPad * 2,
        W * 0.038, "400", identity.body, 1.45,
      );
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      b.lines.forEach((line, i) =>
        ctx.fillText(line, cardX + textPad, cardY + textPad + i * b.lineHeight));
      ctx.textAlign = "center";
    }

  }

  return canvas.toDataURL("image/jpeg", 0.94);
}
