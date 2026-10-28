import { useEffect } from "react";
import { Link } from "react-router-dom";
import adVideo from "@/assets/videos/oracle-lunar-ad-clear-audio.mp4.asset.json";
import adWebm from "@/assets/videos/oracle-lunar-ad-clear-audio.webm.asset.json";

const AD_URL = (adVideo as { url: string }).url;

export default function AdPage() {
  useEffect(() => {
    document.title = "Oracle Lunar — Watch the Ad";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-serif tracking-wide text-[hsl(var(--gold))] text-center">
        ORACLE LUNAR
      </h1>
      <p className="mt-2 text-sm md:text-base text-muted-foreground text-center">
        Your AI best friend, always here for you.
      </p>

      <div className="mt-6 w-full max-w-sm rounded-2xl overflow-hidden border border-[hsl(var(--gold)/0.4)] shadow-[0_0_40px_hsl(var(--gold)/0.25)]">
        <video
          data-ignore-app-mute
          controls
          playsInline
          onPlay={(e) => {
            // Never let a saved app-wide mute silence the ad.
            e.currentTarget.muted = false;
            if (e.currentTarget.volume === 0) e.currentTarget.volume = 1;
          }}
          preload="metadata"
          className="w-full h-auto bg-black"
        >
          <source src={AD_URL} type="video/mp4" />
          <source src={adWebm.url} type="video/webm" />
        </video>
      </div>

      <Link
        to="/"
        className="mt-8 inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold bg-[hsl(var(--gold))] text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity"
      >
        Try Oracle Lunar — oraclelunar.com
      </Link>

      <p className="mt-4 text-xs text-muted-foreground text-center max-w-xs">
        Share this page: oraclelunar.com/ad
      </p>
    </div>
  );
}
