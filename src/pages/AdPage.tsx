import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Download, MessageCircle, Play, RotateCcw } from "lucide-react";
import { isOnProductionHost, openProductionSite } from "@/lib/installRedirect";
import { markLovableAdShown } from "@/lib/lovableVisitor";
import adVideo from "@/assets/videos/oracle-lunar-ad-clear-audio.mp4.asset.json";
import adWebm from "@/assets/videos/oracle-lunar-ad-clear-audio.webm.asset.json";
import adPoster from "@/assets/videos/oracle-lunar-ad-poster.jpg.asset.json";
import funnyVideo from "@/assets/videos/oracle-lunar-funny-cut.mp4.asset.json";
import funnyPoster from "@/assets/videos/oracle-lunar-funny-poster.jpg.asset.json";

const AD_URL = (adVideo as { url: string }).url;
const FUNNY_URL = (funnyVideo as { url: string }).url;

/**
 * Public ad page. The portrait video is sized to fit the phone screen so its
 * play controls are always visible, shows a cover picture before playback
 * (phones otherwise show a blank box) and has a large tap-to-play button.
 */
export default function AdPage() {
  const [params, setParams] = useSearchParams();
  const funny = params.get("v") === "funny";
  const videoUrl = funny ? FUNNY_URL : AD_URL;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const fromLovable = params.get("from") === "lovable";
  // Visitors from anywhere online land here first; when the ad ends they move on to the site.
  const fromWeb = params.get("from") === "web";
  const intro = fromLovable || fromWeb;
  const [countdown, setCountdown] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (intro) markLovableAdShown();
  }, [intro]);

  const enterSite = () => navigate("/", { replace: true });

  useEffect(() => {
    // If the ad can't play, visitors still move on to the site.
    if (!fromWeb || !(ended || failed)) return;
    setCountdown(5);
    const id = window.setInterval(() => {
      setCountdown((n) => (n === null ? null : n - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [fromWeb, ended, failed]);

  useEffect(() => {
    if (countdown !== null && countdown <= 0) enterSite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Inside a Lovable page (or any non-live address) open the real site in its own tab;
  // on oraclelunar.com just move within the app.
  const go = (path: string) => {
    if (isOnProductionHost()) navigate(path);
    else openProductionSite(path);
  };

  const replay = () => {
    const v = videoRef.current;
    setEnded(false);
    setCountdown(null);
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => setStarted(false));
  };

  useEffect(() => {
    document.title = funny ? "Oracle Lunar — The Funny Ad" : "Oracle Lunar — Watch the Ad";
    setStarted(false);
    setFailed(false);
    setEnded(false);
  }, [funny]);

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
      {fromLovable && (
        <p className="mt-2 text-sm text-foreground text-center max-w-xs">
          Tap play to meet Oracle — no sign-up needed to watch.
        </p>
      )}
      {intro && (
        <button
          type="button"
          onClick={() => (fromWeb ? enterSite() : go("/"))}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border border-[hsl(var(--gold)/0.5)] text-foreground hover:bg-[hsl(var(--gold)/0.1)] transition-colors"
        >
          Skip to Oracle Lunar <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Choose an ad">
        {[
          { key: false, label: "The ad" },
          { key: true, label: "The funny ad 😂" },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={funny === t.key}
            onClick={() => setParams(t.key ? { v: "funny" } : {}, { replace: true })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              funny === t.key
                ? "bg-[hsl(var(--gold))] text-[hsl(var(--accent-foreground))] border-transparent"
                : "border-[hsl(var(--gold)/0.4)] text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative mt-3 aspect-[9/16] h-[calc(100svh-18rem)] max-h-[44rem] max-w-full rounded-2xl overflow-hidden border border-[hsl(var(--gold)/0.4)] shadow-[0_0_40px_hsl(var(--gold)/0.25)] bg-background">
        <video
          key={videoUrl}
          ref={videoRef}
          data-ignore-app-mute
          controls={started}
          playsInline
          poster={funny ? funnyPoster.url : adPoster.url}
          preload="metadata"
          onPlay={(e) => {
            // Never let a saved app-wide mute silence the ad.
            e.currentTarget.muted = false;
            if (e.currentTarget.volume === 0) e.currentTarget.volume = 1;
            setStarted(true);
            setEnded(false);
          }}
          onEnded={() => setEnded(true)}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain bg-background"
        >
          <source src={videoUrl} type="video/mp4" />
          {!funny && <source src={adWebm.url} type="video/webm" onError={() => setFailed(true)} />}
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

        {ended && !failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm p-6 text-center">
            <p className="text-xl font-serif text-[hsl(var(--gold))]">Want to meet Oracle for real?</p>
            {fromWeb && countdown !== null && countdown > 0 && (
              <p role="status" className="text-sm font-medium text-foreground">
                Opening Oracle Lunar in {countdown}…
              </p>
            )}
            <p className="text-sm text-muted-foreground max-w-[16rem]">
              She's free to download. Chat, laugh and create with your AI best friend.
            </p>
            <button
              type="button"
              onClick={() => go("/download")}
              className="mt-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-3 text-sm font-semibold bg-[hsl(var(--gold))] text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4 shrink-0" /> Get the app — free
            </button>
            <button
              type="button"
              onClick={() => go("/sign-in")}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium border border-[hsl(var(--gold)/0.5)] text-foreground hover:bg-[hsl(var(--gold)/0.1)] transition-colors"
            >
              <MessageCircle className="h-4 w-4 shrink-0" /> Chat with Oracle
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Watch again
            </button>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 p-6 text-center">
            <p className="text-sm">The ad couldn't play in this browser.</p>
            {fromWeb && countdown !== null && countdown > 0 && (
              <p role="status" className="text-sm font-medium text-foreground">
                Opening Oracle Lunar in {countdown}…
              </p>
            )}
            <a
              href={videoUrl}
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
        to="/download"
        onClick={(e) => {
          if (!isOnProductionHost()) {
            e.preventDefault();
            go("/download");
          }
        }}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-base font-semibold bg-[hsl(var(--gold))] text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity"
      >
        <Download className="h-5 w-5" /> Download the app — free
      </Link>

      <Link
        to="/"
        onClick={(e) => {
          if (!isOnProductionHost()) {
            e.preventDefault();
            go("/");
          }
        }}
        className="mt-3 inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-medium border border-[hsl(var(--gold)/0.5)] text-foreground hover:bg-[hsl(var(--gold)/0.1)] transition-colors"
      >
        Try Oracle Lunar — oraclelunar.com
      </Link>

      <p className="mt-3 text-xs text-muted-foreground text-center max-w-xs">
        Share this page: {funny ? "oraclelunar.com/ad?v=funny" : "oraclelunar.com/ad"} · Download: oraclelunar.com/download
      </p>
    </div>
  );
}
