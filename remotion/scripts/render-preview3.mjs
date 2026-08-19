// Renders the 3-minute hosted preview (Olivia Vance) + mixes VO and score.
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const STILLS_ONLY = process.argv.includes("--stills");
const SILENT = "/tmp/preview3-silent.mp4";
const OUT = "/mnt/documents/scam-the-scammer-3min-hosted-preview.mp4";

const data = JSON.parse(fs.readFileSync(path.join(root, "src/preview3-data.json"), "utf8"));

const bundled = await bundle({ entryPoint: path.resolve(root, "src/index.ts"), webpackOverride: (c) => c });
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});
const composition = await selectComposition({ serveUrl: bundled, id: "preview3", puppeteerInstance: browser });
console.log("frames:", composition.durationInFrames);

if (STILLS_ONLY) {
  for (const f of [40, 1200, 3980, 4150]) {
    await renderStill({
      composition, serveUrl: bundled, frame: f,
      output: `/tmp/p3-${f}.png`, puppeteerInstance: browser, overwrite: true,
    });
    console.log("still", f);
  }
  await browser.close({ silent: false });
  process.exit(0);
}

await renderMedia({
  composition, serveUrl: bundled, codec: "h264", crf: 19,
  outputLocation: SILENT, puppeteerInstance: browser, muted: true, concurrency: 4,
  onProgress: ({ progress }) => {
    const p = Math.round(progress * 100);
    if (p % 10 === 0) process.stdout.write(`${p}% `);
  },
});
await browser.close({ silent: false });
console.log("\nvisuals done");

/* ---------------- audio mix ---------------- */
const inputs = ["-i", SILENT];
const delays = [];
data.segments.forEach((s, i) => {
  inputs.push("-i", path.join(root, "public", s.audio));
  const ms = Math.round(s.start * 1000);
  delays.push(`[${i + 1}:a]adelay=${ms}|${ms},volume=1.0[v${i}]`);
});
const music = path.join(root, "public/audio/music-bed.mp3");
inputs.push("-i", music);
const musicIdx = data.segments.length + 1;
const voTags = data.segments.map((_, i) => `[v${i}]`).join("");
const T = data.total;

const filter = [
  ...delays,
  `${voTags}amix=inputs=${data.segments.length}:duration=longest:normalize=0[vo]`,
  `[vo]asplit=2[sc][vo2]`,
  `[${musicIdx}:a]aloop=loop=-1:size=2e9,atrim=0:${T.toFixed(2)},volume=0.13,afade=t=in:st=0:d=2,afade=t=out:st=${(T - 3).toFixed(2)}:d=3[mus]`,
  `[mus][sc]sidechaincompress=threshold=0.04:ratio=12:attack=6:release=320[duck]`,
  `[duck][vo2]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`,
].join(";");

console.log("mixing audio…");
execFileSync("ffmpeg", [
  "-y", ...inputs, "-filter_complex", filter, "-map", "0:v", "-map", "[aout]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", OUT,
], { stdio: "inherit" });
console.log("done ->", OUT);
