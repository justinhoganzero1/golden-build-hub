import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: {
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: "main",
  puppeteerInstance: browser,
});

await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  audioCodec: "aac",
  outputLocation: "/mnt/documents/oracle-lunar-making-of-v2.mp4",
  puppeteerInstance: browser,
  muted: false,
  enforceAudioTrack: true,
  concurrency: 1,
  onProgress: ({ progress }) => {
    if (Math.floor(progress * 100) % 10 === 0) {
      process.stdout.write(`\rProgress: ${(progress * 100).toFixed(0)}%`);
    }
  },
});

await browser.close({ silent: false });
console.log("\nDone");
