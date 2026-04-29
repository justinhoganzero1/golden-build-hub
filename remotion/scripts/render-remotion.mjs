import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SILENT_VIDEO = "/tmp/remotion-silent.mp4";
const NARRATOR = path.resolve(__dirname, "../public/audio/vo-narrator.mp3");
const ORACLE   = path.resolve(__dirname, "../public/audio/vo-oracle.mp3");
const FINAL    = "/mnt/documents/oracle-lunar-making-of-v2.mp4";

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
    if (Math.floor(progress * 100) % 10 === 0) {
      process.stdout.write(`\rVideo: ${(progress * 100).toFixed(0)}%`);
    }
  },
});
console.log("\nSilent video rendered.");

await browser.close({ silent: false });

// Mix audio with system ffmpeg (which has native AAC encoder)
// Narrator from 0s, Oracle from 24s (frame 720 @ 30fps)
console.log("Muxing audio (narrator + oracle delayed 24s)...");
const cmd = `ffmpeg -y -i ${SILENT_VIDEO} -i ${NARRATOR} -i ${ORACLE} \
  -filter_complex "[2:a]adelay=24000|24000[oracle];[1:a][oracle]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,volume=1.4[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest ${FINAL}`;
execSync(cmd, { stdio: "inherit" });

const stat = fs.statSync(FINAL);
console.log(`\nDone: ${FINAL}  (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
