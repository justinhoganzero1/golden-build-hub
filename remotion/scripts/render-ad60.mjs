// Renders the 60s Oracle Lunar ad and mixes narration + punchy score + SFX.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const A = (f) => path.join(root, "public/audio", f);

const SILENT = "/tmp/ad60-silent.mp4";
const OUT = "/mnt/documents/oracle-lunar-60s-ad.mp4";

// Scene cut times (seconds) — must match BEATS in src/Ad60.tsx
const CUTS = [6.0, 12.8, 16.8, 19.9, 22.6, 25.3, 29.9, 33.0, 36.0, 43.0, 45.4, 49.2, 52.2, 55.7];
const VO_OFFSET = 1.0;

const bundled = await bundle({
  entryPoint: path.resolve(root, "src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({ serveUrl: bundled, id: "ad60", puppeteerInstance: browser });

console.log("rendering visuals…");
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  crf: 17,
  outputLocation: SILENT,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 2,
  onProgress: ({ progress }) => {
    if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`${Math.round(progress * 100)}% `);
  },
});
await browser.close({ silent: false });
console.log("\nvisuals done");

/* ---------------- audio mix ---------------- */
const inputs = [
  "-i", SILENT,
  "-i", A("ad60-vo-fast.mp3"),   // 1 narration (58.26s)
  "-i", A("ad60-music.mp3"),     // 2 punchy score
  "-i", A("ad30-impact.mp3"),    // 3 braam
  "-i", A("ad30-whoosh.mp3"),    // 4 whoosh
];

// one whoosh per scene cut, plus impacts on the open and the finale
const whooshes = CUTS.map((t, i) => `[4:a]adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=0.28[w${i}]`);
const whooshTags = CUTS.map((_, i) => `[w${i}]`).join("");

const filter = [
  // narration: bright, compressed, pushed forward
  `[1:a]adelay=${VO_OFFSET * 1000}|${VO_OFFSET * 1000},highpass=f=90,` +
    `equalizer=f=3200:t=q:w=1.4:g=3.5,acompressor=threshold=-18dB:ratio=4:attack=6:release=180,volume=1.35[vo]`,
  // score: full and loud in the gaps, ducked under the VO
  `[2:a]atrim=0:60,volume=0.42,afade=t=in:st=0:d=0.5,afade=t=out:st=57.6:d=2.4[mus0]`,
  `[vo]asplit=2[vo1][vokey]`,
  `[mus0][vokey]sidechaincompress=threshold=0.03:ratio=12:attack=5:release=260:makeup=1[mus]`,
  `[3:a]adelay=0|0,volume=0.6[imp0]`,
  `[3:a]adelay=55700|55700,volume=0.55[imp1]`,
  ...whooshes,
  `[vo1][mus][imp0][imp1]${whooshTags}amix=inputs=${4 + CUTS.length}:duration=first:dropout_transition=0:normalize=0[mixed]`,
  `[mixed]loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.95[aout]`,
].join(";");

console.log("mixing audio…");
execFileSync(
  "ffmpeg",
  ["-y", "-v", "error", ...inputs,
    "-filter_complex", filter,
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", "-shortest", OUT],
  { stdio: "inherit" },
);

console.log("done →", OUT);
