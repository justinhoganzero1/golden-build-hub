import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = (f) => path.resolve(__dirname, "../public/audio/" + f);
const SILENT = "/tmp/oracle-ad30-v2-silent.mp4";
const VO = A("ad30-vo-v2.mp3");
const MUSIC = A("ad30-music-v2.mp3");
const WHOOSH = A("ad30-whoosh.mp3");
const IMPACT = A("ad30-impact.mp3");
const FINAL = "/mnt/documents/oracle-lunar-30s-ad-v2.mp4";

// Scene cut points (seconds) taken from the AdVideo timeline at 30fps.
const CUTS = [3.6, 8.0, 12.4, 17.0, 21.4, 26.0];

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: "ad30",
  puppeteerInstance: browser,
});

console.log("Rendering picture...");
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: SILENT,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 1,
  onProgress: ({ progress }) => process.stdout.write(`\rVideo: ${(progress * 100).toFixed(0)}%`),
});
await browser.close({ silent: false });

console.log("\nMixing soundtrack (narration + music bed + SFX)...");

// inputs: 0 video, 1 VO, 2 music, 3 impact-open, 4 impact-outro, 5..N whooshes
const inputs = [
  `-i ${SILENT}`,
  `-i ${VO}`,
  `-i ${MUSIC}`,
  `-i ${IMPACT}`,
  `-i ${IMPACT}`,
  ...CUTS.map(() => `-i ${WHOOSH}`),
].join(" ");

const filters = [
  // Narration: starts just after the opening hit, ducked-forward and loud.
  `[1:a]adelay=900|900,volume=1.75,acompressor=threshold=0.15:ratio=3:attack=8:release=180[vo]`,
  // Music bed: full-length under everything, ducked by the narration.
  `[2:a]volume=0.30,afade=t=in:st=0:d=1.2,afade=t=out:st=27.8:d=2.2[musraw]`,
  `[musraw][vo]sidechaincompress=threshold=0.05:ratio=7:attack=6:release=320[mus]`,
  // Opening braam + outro braam.
  `[3:a]volume=0.55,afade=t=out:st=1.6:d=0.9[hit1]`,
  `[4:a]adelay=25900|25900,volume=0.6[hit2]`,
  // Whoosh on every scene cut.
  ...CUTS.map((t, i) => {
    const ms = Math.max(0, Math.round((t - 0.35) * 1000));
    return `[${5 + i}:a]adelay=${ms}|${ms},volume=0.34[wh${i}]`;
  }),
  `[vo][mus][hit1][hit2]${CUTS.map((_, i) => `[wh${i}]`).join("")}amix=inputs=${4 + CUTS.length}:duration=longest:dropout_transition=0:normalize=0[mixed]`,
  `[mixed]alimiter=limit=0.95,aresample=48000[aout]`,
].join(";");

const cmd = `ffmpeg -y -loglevel error ${inputs} -filter_complex "${filters}" -map 0:v -map "[aout]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.2 -movflags +faststart -c:a aac -b:a 320k -ar 48000 -ac 2 -t 30 ${FINAL}`;
execSync(cmd, { stdio: "inherit" });

const stat = fs.statSync(FINAL);
console.log(`\nDone: ${FINAL} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
