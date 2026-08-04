import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
const b = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride: c=>c });
const browser = await openBrowser("chrome", { browserExecutable: "/bin/chromium", chromiumOptions:{args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]}, chromeMode:"chrome-for-testing" });
const c = await selectComposition({ serveUrl:b, id:"main", puppeteerInstance:browser });
await renderMedia({ composition:c, serveUrl:b, codec:"h264", outputLocation:"/tmp/t.mp4", puppeteerInstance:browser, muted:true, concurrency:1, frameRange:[0,4] });
console.log("MAIN_OK");
await browser.close({silent:false});
