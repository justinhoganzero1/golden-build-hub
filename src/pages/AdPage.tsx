import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import adVideo from "@/assets/videos/oracle-lunar-ad-clear-audio.mp4.asset.json";
import adWebm from "@/assets/videos/oracle-lunar-ad-clear-audio.webm.asset.json";
import adPoster from "@/assets/videos/oracle-lunar-ad-poster.jpg.asset.json";

const AD_URL = (adVideo as { url: string }).url;

/**
 * Public ad page. The portrait video is sized to fit the phone screen so its
 * play controls are always visible, shows a cover picture before playback
 * (phones otherwise show a blank box) and has a large tap-to-play button.
 */
export default function AdPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = "Oracle Lunar — Watch the Ad";
  }, []);

  const play = async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    if (v.volume === 0) v.volume = 1;
    setStarted(true);
    try {
      await v.play();
    } catch {
      // Some browsers refuse sound without a direct tap on the video itself;
      // the native controls remain available.
      setStarted(false);
    }
  };

  return (
    <div className="min-h-[100svh] bg-background text-foreground flex flex-col items-center px-4 py-6">
      <h1 className="text-2xl md:text-4xl font-serif tracking-wide text-[hsl(var(--gold))] text-center">
        ORACLE LUNAR
      </h1>
      <p className="mt-1 text-sm md:text-base text-muted-foreground text-center">
        Your AI best friend, always here for you.
      </p>

      <div className="relative mt-4 aspect-[9/16] h-[calc(100svh-12rem)] max-h-[44rem] max-w-full rounded-2xl overflow-hidden border border-[hsl(var(--gold)/0.4)] shadow-[0_0_40px_hsl(var(--gold)/0.25)] bg-background">
        <video
          ref={videoRef}
          data-ignore-app-mute
          controls={started}
          playsInline
          poster={adPoster.url}
          preload="metadata"
          onPlay={(e) => {
            // Never let a saved app-wide mute silence the ad.
            e.currentTarget.muted = false;
            if (e.currentTarget.volume === 0) e.currentTarget.volume = 1;
            setStarted(true);
          }}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain bg-background"
        >
          <source src={AD_URL} type="video/mp4" />
          <source src={adWebm.url} type="video/webm" onError={() => setFailed(true)} />
        </video>

        {!started && !failed && (
          <button
            type="button"
            onClick={play}
            aria-label="Play the ad"
            className="absolute inset-0 flex items-center justify-center bg-background/20"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--gold))] text-[hsl(var(--accent-foreground))] shadow-[0_0_30px_hsl(var(--gold)/0.6)]">
              <Play className="h-10 w-10 translate-x-0.5" fill="currentColor" />
            </span>
          </button>
        )}

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 p-6 text-center">
            <p className="text-sm">The ad couldn't play in this browser.</p>
            <a
              href={AD_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-6 py-2 text-sm font-semibold bg-[hsl(var(--gold))] text-[hsl(var(--accent-foreground))]"
            >
              Open the video
            </a>
          </div>
        )}
      </div>

      <Link
        to="/"
        className="mt-5 inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold bg-[hsl(var(--gold))] text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity"
      >
        Try Oracle Lunar — oraclelunar.com
      </Link>

      <p className="mt-3 text-xs text-muted-foreground text-center max-w-xs">
        Share this page: oraclelunar.com/ad
      </p>
    </div>
  );
}
