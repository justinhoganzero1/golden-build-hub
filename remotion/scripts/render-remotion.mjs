import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SILENT_VIDEO = "/tmp/remotion-silent-v4.mp4";
const A = (n) => path.resolve(__dirname, `../public/audio/${n}.mp3`);
const NAR1   = A("v4-narrator-1");
const NAR2   = A("v4-narrator-2");
const ORS    = A("v4-oracle-screen");
const ORP    = A("v4-oracle-phone");
const LAUGH  = A("v4-laugh");
const OUTRO  = A("v4-narrator-outro");
const MUSIC  = A("v4-music");
const FINAL  = "/mnt/documents/oracle-lunar-making-of-v4.mp4";

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
  id: "main",
  puppeteerInstance: browser,
});

console.log("Rendering silent video...");
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: SILENT_VIDEO,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 1,
  onProgress: ({ progress }) => {
    process.stdout.write(`\rVideo: ${(progress * 100).toFixed(0)}%`);
  },
});
console.log("\nSilent video rendered.");
await browser.close({ silent: false });

// Mux: 6 voice tracks + music bed (ducked).
// Timeline (seconds):
//   nar1   0.0
//   nar2  10.0
//   ors   17.0
//   orp   21.0
//   laugh 23.5
//   outro 30.0
//   music 0–35, vol 0.20, fade in/out
console.log("Muxing audio...");
const cmd = `ffmpeg -y \
 -i ${SILENT_VIDEO} \
 -i ${NAR1} -i ${NAR2} -i ${ORS} -i ${ORP} -i ${LAUGH} -i ${OUTRO} -i ${MUSIC} \
 -filter_complex "\
[1:a]adelay=0|0,volume=1.3[a1];\
[2:a]adelay=10000|10000,volume=1.3[a2];\
[3:a]adelay=17000|17000,volume=1.4[a3];\
[4:a]adelay=21000|21000,volume=1.4[a4];\
[5:a]adelay=23500|23500,volume=1.0[a5];\
[6:a]adelay=30000|30000,volume=1.4[a6];\
[7:a]volume=0.20,afade=t=in:st=0:d=2,afade=t=out:st=33:d=2[mus];\
[a1][a2][a3][a4][a5][a6]amix=inputs=6:duration=longest:dropout_transition=0:normalize=0[vo];\
[vo][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]" \
 -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest ${FINAL}`;
execSync(cmd, { stdio: "inherit" });

const stat = fs.statSync(FINAL);
console.log(`\nDone: ${FINAL}  (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
