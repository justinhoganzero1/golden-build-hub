// Renders the full 20-chapter "Scam the Scammer — Juzzy Style" YouTube feature
// from the Story Writer book: 42 illustrated beats, narration per beat, ducked music bed.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const VO = "/tmp/movie/vo";
const MUSIC = path.join(root, "public/audio/v4-music.mp3");
const SILENT = "/tmp/movie/silent.mp4";
const OUT = "/mnt/documents/scam-the-scammer-juzzy-style-youtube.mp4";

const beats = JSON.parse(fs.readFileSync(path.join(root, "src/storycut-data.json"), "utf8"));

const bundled = await bundle({ entryPoint: path.resolve(root, "src/index.ts"), webpackOverride: (c) => c });

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
  crf: 20,
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

const inputs = ["-i", SILENT];
const delays = [];
let t = 0;
beats.forEach((b, i) => {
  inputs.push("-i", `${VO}/${String(i).padStart(2, "0")}.mp3`);
  const ms = Math.round((t + 0.4) * 1000);
  delays.push(`[${i + 1}:a]adelay=${ms}|${ms},volume=1.0[v${i}]`);
  t += b.d;
});
inputs.push("-i", MUSIC);
const musicIdx = beats.length + 1;
const voTags = beats.map((_, i) => `[v${i}]`).join("");
const filter = [
  ...delays,
  `${voTags}amix=inputs=${beats.length}:duration=longest:normalize=0[vo]`,
  `[${musicIdx}:a]aloop=loop=-1:size=2e9,atrim=0:${(t + 4).toFixed(2)},volume=0.15,afade=t=in:st=0:d=2,afade=t=out:st=${(t + 1.2).toFixed(2)}:d=2.5[mus]`,
  `[mus][vo]sidechaincompress=threshold=0.045:ratio=11:attack=6:release=340[duck]`,
  `[duck][vo]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`,
].join(";");

console.log("mixing audio…");
execFileSync("ffmpeg", ["-y", ...inputs, "-filter_complex", filter, "-map", "0:v", "-map", "[aout]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", OUT], { stdio: "inherit" });
console.log("done ->", OUT);
