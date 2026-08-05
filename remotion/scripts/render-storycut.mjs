// Renders the 3-minute condensed "Scam the Scammer Juzzy Style" movie cut
// and mixes per-scene narration + music bed.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SMOKE = "/tmp/smoke";
const SILENT = "/tmp/storycut-silent.mp4";
const OUT = "/mnt/documents/scam-the-scammer-juzzy-style-3min.mp4";

const beats = JSON.parse(fs.readFileSync(path.join(root, "src/storycut-data.json"), "utf8"));

const bundled = await bundle({
  entryPoint: path.resolve(root, "src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({ serveUrl: bundled, id: "storycut", puppeteerInstance: browser });
console.log("frames:", composition.durationInFrames);

await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  crf: 19,
  outputLocation: SILENT,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 4,
  onProgress: ({ progress }) => {
    const p = Math.round(progress * 100);
    if (p % 5 === 0) process.stdout.write(`${p}% `);
  },
});
await browser.close({ silent: false });
console.log("\nvisuals done");

/* -------- narration track: place each VO clip at its scene start -------- */
const inputs = ["-i", SILENT];
const delays = [];
let t = 0;
beats.forEach((b, i) => {
  inputs.push("-i", `${SMOKE}/vo/${String(i).padStart(2, "0")}.mp3`);
  delays.push(`[${i + 1}:a]adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=1.0[v${i}]`);
  t += b.d;
});
inputs.push("-i", `${SMOKE}/music.mp3`);
const musicIdx = beats.length + 1;

const voTags = beats.map((_, i) => `[v${i}]`).join("");
const filter = [
  ...delays,
  `${voTags}amix=inputs=${beats.length}:duration=longest:normalize=0[vo]`,
  `[${musicIdx}:a]aloop=loop=-1:size=2e9,atrim=0:${(t + 4).toFixed(2)},volume=0.16,afade=t=in:st=0:d=2,afade=t=out:st=${(t + 1.2).toFixed(2)}:d=2.5[mus]`,
  `[mus][vo]sidechaincompress=threshold=0.05:ratio=9:attack=8:release=380[duck]`,
  `[duck][vo]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`,
].join(";");

console.log("mixing audio…");
execFileSync(
  "ffmpeg",
  ["-y", ...inputs, "-filter_complex", filter, "-map", "0:v", "-map", "[aout]",
   "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", OUT],
  { stdio: "inherit" }
);
console.log("done ->", OUT);
