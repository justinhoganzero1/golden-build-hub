// Oracle News credit banner: Oracle Lunar on the left (blue), then who the clip came from (red), white divider.
// Drawn on the studio canvas for every borrowed or licensed visual, and as a strip over clips playing in YouTube's player.
const hsl = (v: string, fb: string) => {
  if (typeof document === "undefined") return fb;
  const x = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return x ? `hsl(${x})` : fb;
};

export function creditLabel(credit: string): string {
  return `Footage: ${credit}`.toUpperCase();
}

/** Draws the banner across the very bottom of the picture (below the name strip). */
export function drawCreditBanner(ctx: CanvasRenderingContext2D, credit: string | null, width: number, height: number) {
  if (!credit) return;
  const u = width / 1280;
  const h = 40 * u; const y = height - h - 10 * u; const x = 40 * u; const w = width - 80 * u;
  const red = hsl("--news-red", "#c62828"), white = hsl("--news-white", "#ffffff"), blue = hsl("--news-blue", "#1e3a8a");
  ctx.save();
  ctx.font = `800 ${18 * u}px system-ui, sans-serif`;
  const brand = "ORACLE LUNAR";
  const bw = ctx.measureText(brand).width + 36 * u;
  ctx.fillStyle = blue; ctx.fillRect(x, y, bw, h);
  ctx.fillStyle = white; ctx.fillRect(x + bw, y, 6 * u, h);
  ctx.fillStyle = red; ctx.fillRect(x + bw + 6 * u, y, w - bw - 6 * u, h);
  ctx.fillStyle = white; ctx.textBaseline = "middle";
  ctx.fillText(brand, x + 18 * u, y + h / 2);
  ctx.font = `700 ${17 * u}px system-ui, sans-serif`;
  let label = creditLabel(credit);
  const max = w - bw - 40 * u;
  while (label.length > 8 && ctx.measureText(label).width > max) label = `${label.slice(0, -2)}…`.replace(/……$/, "…");
  ctx.fillText(label, x + bw + 24 * u, y + h / 2);
  ctx.restore();
}

/** Same banner as a strip for clips that play in YouTube's own player. */
export const CreditBanner = ({ credit, className = "", compact = false }: { credit: string; className?: string; compact?: boolean }) => (
  <div className={`flex items-stretch text-[10px] sm:text-sm font-extrabold tracking-wide leading-none ${className}`} aria-label={`Oracle Lunar — footage from ${credit}`}>
    <span className="px-2 sm:px-3 py-1.5 sm:py-2 bg-[hsl(var(--news-blue))] text-[hsl(var(--news-white))] whitespace-nowrap">ORACLE LUNAR</span>
    <span className="w-1 sm:w-1.5 bg-[hsl(var(--news-white))]" />
    <span className="flex-1 min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 bg-[hsl(var(--news-red))] text-[hsl(var(--news-white))] truncate">{compact ? credit.toUpperCase() : creditLabel(credit)}</span>
  </div>
);

/** YouTube player address for a borrowed clip: muted autoplay so the presenter's voice stays clear. */
export function clipPlayerUrl(embedUrl: string, opts: { autoplay?: boolean; muted?: boolean } = {}): string {
  const u = new URL(embedUrl);
  if (opts.autoplay) u.searchParams.set("autoplay", "1");
  if (opts.muted) u.searchParams.set("mute", "1");
  // Live broadcast: no player buttons on screen, and captions stay off (house rule: no subtitles).
  if (opts.autoplay) u.searchParams.set("controls", "0");
  u.searchParams.set("cc_load_policy", "0");
  u.searchParams.set("playsinline", "1");
  u.searchParams.set("rel", "0");
  u.searchParams.set("modestbranding", "1");
  return u.toString();
}
