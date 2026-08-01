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

function goldGradient(ctx: CanvasRenderingContext2D, y: number, h: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#fff7e0");
  g.addColorStop(0.5, "#ffd77a");
  g.addColorStop(1, "#c9962f");
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
  const targetH = opts.size ?? 2048;
  const ratio = (img.naturalWidth || 1400) / (img.naturalHeight || 2100);
  const H = targetH;
  const W = Math.round(H * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable in this browser");

  ctx.drawImage(img, 0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const pad = W * 0.07;
  const inner = W - pad * 2;
  const title = (opts.title || "Untitled").toUpperCase();
  const author = opts.author || "Author";

  if (opts.slot === "cover") {
    scrim(ctx, W, 0, H * 0.42, "top");
    let y = H * 0.055;

    if (opts.genre) {
      ctx.font = `600 ${W * 0.026}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,215,122,0.9)";
      ctx.fillText(opts.genre.toUpperCase().split("").join(" "), W / 2, y);
      y += W * 0.055;
    }

    ctx.fillStyle = "rgba(255,215,122,0.6)";
    ctx.fillRect(W * 0.2, y, W * 0.6, Math.max(1, W * 0.002));
    y += W * 0.035;

    const t = fitLines(ctx, title, inner, H * 0.24, W * 0.13, "900", "Georgia, 'Times New Roman', serif", 1.02);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = W * 0.02;
    ctx.shadowOffsetY = W * 0.006;
    ctx.fillStyle = goldGradient(ctx, y, t.lines.length * t.lineHeight);
    t.lines.forEach((line, i) => ctx.fillText(line, W / 2, y + i * t.lineHeight));
    ctx.restore();
    y += t.lines.length * t.lineHeight + W * 0.03;

    ctx.fillStyle = "rgba(255,215,122,0.5)";
    ctx.fillRect(W * 0.33, y, W * 0.34, Math.max(1, W * 0.0015));

    // Author footer
    scrim(ctx, W, H * 0.74, H * 0.26, "bottom");
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = W * 0.015;
    ctx.font = `500 ${W * 0.024}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText("A  N O V E L   B Y", W / 2, H * 0.885);
    ctx.font = `700 ${W * 0.055}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(author.toUpperCase(), W / 2, H * 0.915);
    ctx.restore();
  } else {
    scrim(ctx, W, 0, H * 0.22, "top");

    let y = H * 0.05;
    const t = fitLines(ctx, title, inner, H * 0.12, W * 0.085, "900", "Georgia, 'Times New Roman', serif", 1.05);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = W * 0.02;
    ctx.fillStyle = goldGradient(ctx, y, t.lines.length * t.lineHeight);
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
      ctx.strokeStyle = "rgba(255,215,122,0.35)";
      ctx.lineWidth = Math.max(1, W * 0.002);
      ctx.stroke();
      ctx.restore();

      const textPad = W * 0.045;
      const b = fitLines(
        ctx, blurb, cardW - textPad * 2, cardH - textPad * 2,
        W * 0.038, "400", "Georgia, 'Times New Roman', serif", 1.45,
      );
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      b.lines.forEach((line, i) =>
        ctx.fillText(line, cardX + textPad, cardY + textPad + i * b.lineHeight));
      ctx.textAlign = "center";
    }

    scrim(ctx, W, H * 0.8, H * 0.2, "bottom");
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = W * 0.015;
    ctx.font = `700 ${W * 0.045}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(author.toUpperCase(), W / 2, H * 0.925);
    ctx.restore();
  }

  return canvas.toDataURL("image/jpeg", 0.94);
}
