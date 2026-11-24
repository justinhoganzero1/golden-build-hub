import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";

const download = () => {
  fetch("/oracle-lunar-extension.zip")
    .then(r => { if (!r.ok) throw new Error(`Download failed: ${r.status}`); return r.blob(); })
    .then(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "oracle-lunar-extension.zip"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); })
    .catch(e => alert(e.message));
};

const ChromeExtensionPage = () => {
  useEffect(() => { document.title = "Oracle Lunar Chrome Extension | Ask Oracle from Google"; }, []);
  return (
    <main data-no-tab-glow className="oracle-signin">
      <img src={officeBackdrop} alt="" aria-hidden className="oracle-signin-bg" width={848} height={1264} />
      <div aria-hidden className="oracle-signin-scrim" />
      <section className="oracle-signin-card space-y-4" aria-labelledby="ext-title">
        <h1 id="ext-title" className="oracle-signin-title">Oracle Lunar for Chrome</h1>
        <p className="text-sm text-muted-foreground">Adds a small "Ask Oracle" button beside your Google searches and a quick box in your toolbar. It's free and reads nothing else.</p>
        <Button className="w-full" onClick={download}><Download className="mr-1.5 h-4 w-4" />Download extension</Button>
        <ol className="list-decimal pl-5 text-sm text-foreground space-y-1">
          <li>Unzip the downloaded file.</li>
          <li>Open <b>chrome://extensions</b> in Chrome, Edge or Brave.</li>
          <li>Turn on <b>Developer mode</b> (top right).</li>
          <li>Tap <b>Load unpacked</b> and pick the unzipped folder.</li>
        </ol>
        <Link to="/download" className="text-sm text-primary underline">Get the Oracle Lunar app</Link>
      </section>
    </main>
  );
};
export default ChromeExtensionPage;
