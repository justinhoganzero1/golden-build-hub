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
const MUSIC    = path.resolve(__dirname, "../public/audio/music-bed.mp3");
const FINAL    = "/mnt/documents/oracle-lunar-making-of-v3.mp4";

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

// Audio mix:
// - Narrator: from 0s, full volume
// - Oracle: delayed to scene 5 start = (120+240+150+210)/30 = 24s, full volume
// - Music: throughout, ducked to ~22% so VO is clear, fade out at end
console.log("Muxing narrator + oracle + music bed...");
const cmd = `ffmpeg -y -i ${SILENT_VIDEO} -i ${NARRATOR} -i ${ORACLE} -i ${MUSIC} \
  -filter_complex "\
[3:a]volume=0.22,afade=t=in:st=0:d=2,afade=t=out:st=29:d=2[music];\
[2:a]adelay=24000|24000[oracle];\
[1:a][oracle]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,volume=1.4[vo];\
[vo][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest ${FINAL}`;
execSync(cmd, { stdio: "inherit" });

const stat = fs.statSync(FINAL);
console.log(`\nDone: ${FINAL}  (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
