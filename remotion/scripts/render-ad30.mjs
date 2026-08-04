import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SILENT = "/tmp/oracle-ad30-silent.mp4";
const VO = path.resolve(__dirname, "../public/audio/ad30-vo.mp3");
const MUSIC = path.resolve(__dirname, "../public/audio/music-bed.mp3");
const FINAL = "/mnt/documents/oracle-lunar-30s-ad.mp4";

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

console.log("Rendering ad...");
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

console.log("\nMuxing narration + music...");
const cmd = `ffmpeg -y -i ${SILENT} -i ${VO} -i ${MUSIC} -filter_complex "\
[1:a]atempo=1.05,volume=1.6[vo];\
[2:a]volume=0.14,afade=t=in:st=0:d=1.5,afade=t=out:st=28:d=2[mus];\
[vo][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]" \
 -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest ${FINAL}`;
execSync(cmd, { stdio: "inherit" });

const stat = fs.statSync(FINAL);
console.log(`\nDone: ${FINAL} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
