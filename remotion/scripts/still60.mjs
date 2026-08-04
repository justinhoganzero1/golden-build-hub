import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
const root="/dev-server/remotion";
const b = await bundle({ entryPoint: path.resolve(root,"src/index.ts"), webpackOverride:(c)=>c });
const browser = await openBrowser("chrome",{browserExecutable:"/bin/chromium",chromiumOptions:{args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]},chromeMode:"chrome-for-testing"});
const composition = await selectComposition({serveUrl:b,id:"ad60",puppeteerInstance:browser});
for (const f of [60,260,430,700,860,1150,1420,1600,1750]) {
  await renderStill({composition,serveUrl:b,output:`/tmp/qa60/f${f}.png`,frame:f,puppeteerInstance:browser,overwrite:true});
  console.log("ok",f);
}
await browser.close({silent:false});
