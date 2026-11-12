import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, ChevronDown, Download, Globe, Laptop, Lock, Mail, MonitorSmartphone,
  Play, Share2, ShieldCheck, Smartphone, Sparkles, Volume2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ApkDownloadDialog from "@/components/ApkDownloadDialog";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { detectInstallPlatform, trackInstallEvent } from "@/lib/installAnalytics";
import {
  PUBLIC_URL, checkApkAvailable, downloadApk, getNativeStoreUrl, isAndroidDevice, isOnProductionHost, openProductionSite,
} from "@/lib/installRedirect";
import { FREE_FEATURES, PLANS } from "@/lib/plans";
import { toast } from "sonner";
import appIcon from "@/assets/store/app-icon.jpg";
import shotChat from "@/assets/store/shot-oracle-chat.jpg";
import shotSignIn from "@/assets/store/shot-sign-in.jpg";
import shotDashboard from "@/assets/store/shot-dashboard.jpg";
import shotVideos from "@/assets/store/shot-oracle-videos.jpg";
import shotPlans from "@/assets/store/shot-plans.jpg";
import shotCalendar from "@/assets/store/shot-calendar.jpg";
import portrait from "@/assets/avatars/oracle-futuristic-office.jpg";
import listeningClip from "@/assets/avatars/oracle-office-listening-smooth.webm";
import greetingClip from "@/assets/avatars/oracle-clip-greeting.webm";

/**
 * Public front door laid out like an app-store listing. Visitors install the
 * app straight from here (home-screen app on iPhone, Android and computers,
 * or the Android file / store listing once those exist). Real screenshots of
 * the app only, and no invented star ratings or download counts.
 */

const SCREENSHOTS = [
  { src: shotChat, alt: "Oracle greets you and asks what you'd like to do" },
  { src: shotDashboard, alt: "Your Oracle Lunar home with all your tools" },
  { src: shotVideos, alt: "Oracle Videos included in membership" },
  { src: shotCalendar, alt: "Calendar and diary" },
  { src: shotPlans, alt: "Simple plans — start free" },
  { src: shotSignIn, alt: "Sign in to your private account" },
];

const WHATS_NEW = [
  "Brand-new sign-in screen",
  "Oracle's face stays clear — tap the chat button to read her replies",
  "Faster replies and her new premium voice",
  "Creator Shop: sell your templates and keep 80% in your wallet",
  "A friendly welcome tour for new members",
];

const TAGS = ["AI companion", "Voice chat", "Stories", "Videos", "Wellbeing", "Planner"];

type Platform = ReturnType<typeof detectInstallPlatform>;

const isInAppBrowser = () =>
  typeof navigator !== "undefined" && /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|LinkedInApp|Twitter/i.test(navigator.userAgent);

export default function AppStorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { canInstall, isStandalone, installed, install } = usePWAInstall();
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [apkReady, setApkReady] = useState(false);
  const [apkOpen, setApkOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const mainButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlatform(detectInstallPlatform());
    if (isAndroidDevice()) checkApkAvailable().then(setApkReady);
  }, []);

  // Small install bar at the bottom once the main button scrolls away.
  useEffect(() => {
    const el = mainButtonRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleInstall = async () => {
    trackInstallEvent("click", platform, "store-page");
    if (isStandalone || installed) {
      navigate("/sign-in");
      return;
    }
    // Inside the editor preview or another web address the install offer can't work.
    if (!isOnProductionHost()) {
      openProductionSite("/");
      return;
    }
    if (isAndroidDevice() && apkReady) {
      // Start the real app download right away, then show the finishing steps.
      trackInstallEvent("download_start", "android", "store-page");
      downloadApk();
      setApkOpen(true);
      return;
    }
    const storeUrl = getNativeStoreUrl();
    if (storeUrl) {
      window.open(storeUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (canInstall) {
      const outcome = await install();
      if (outcome === "accepted") {
        trackInstallEvent("installed", platform, "store-page");
        toast.success("Oracle Lunar is installing — look for her icon with your apps.");
        return;
      }
      if (outcome === "dismissed") return;
    }
    trackInstallEvent("guide_open", platform, "store-page");
    setHelpOpen(true);
  };

  const share = async () => {
    const data = { title: "Oracle Lunar", text: "Your AI best friend, always here for you.", url: PUBLIC_URL };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(PUBLIC_URL);
        toast.success("Link copied");
      }
    } catch { /* user closed the share sheet */ }
  };

  const installLabel = isStandalone || installed ? "Open" : "Install";
  const deviceLine =
    platform === "ios" ? "Installs on your iPhone or iPad"
    : platform === "android" ? "Installs on your Android phone or tablet"
    : "Installs on your computer — also on phones and tablets";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={appIcon} alt="" className="h-8 w-8 rounded-[22%]" />
            <span className="text-lg font-semibold tracking-tight">Oracle <span className="text-primary">Lunar</span></span>
          </Link>
          {user ? (
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/owner-dashboard">Owner dashboard</Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link to="/oracle">Open app</Link>
              </Button>
            </div>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:grid lg:grid-cols-[1fr_300px] lg:gap-12">
        <div className="min-w-0">
          {/* App header */}
          <section className="flex items-start gap-4 sm:gap-6">
            <img
              src={appIcon}
              alt="Oracle Lunar app icon"
              className="h-20 w-20 shrink-0 rounded-[22%] shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.6)] ring-1 ring-border sm:h-28 sm:w-28"
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">Oracle Lunar</h1>
              <p className="mt-1 text-sm font-medium text-primary sm:text-base">Your AI best friend, always here for you</p>
              <p className="mt-1 text-xs text-muted-foreground">Oracle Lunar · Contains in-app purchases</p>
            </div>
          </section>

          {/* Stats row */}
          <section className="mt-6 flex items-stretch overflow-x-auto rounded-xl border border-border/60 bg-card/40 py-3 text-center [scrollbar-width:none]">
            {[
              { top: "Free", bottom: "to install" },
              { top: "16+", bottom: "Rated for 16+" },
              { top: `A$${PLANS.plus.monthlyAud}`, bottom: "Plus per month" },
              { top: <MonitorSmartphone className="mx-auto h-5 w-5" />, bottom: "Any device" },
            ].map((s, i) => (
              <div key={i} className="flex min-w-[88px] flex-1 flex-col justify-center border-l border-border/60 px-3 first:border-l-0">
                <div className="text-base font-semibold">{s.top}</div>
                <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">{s.bottom}</div>
              </div>
            ))}
          </section>

          {/* Install */}
          <section ref={mainButtonRef} className="mt-6">
            <div className="flex gap-3">
              <Button onClick={handleInstall} size="lg" className="h-12 flex-1 text-base font-semibold sm:max-w-xs">
                <Download className="mr-2 h-5 w-5" />{installLabel}
              </Button>
              <Button onClick={share} variant="outline" size="lg" className="h-12 px-4" aria-label="Share Oracle Lunar">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              {platform === "desktop" ? <Laptop className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              {deviceLine}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">No sign-in needed to download — you create your account inside the app.</p>
            <Link to="/sign-in" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Globe className="h-3.5 w-3.5" />Or use it right here in your browser
            </Link>
          </section>

          {/* Screenshots */}
          <section className="-mx-4 mt-8">
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => setSoundOn(true)}
                className="relative h-[380px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border/60 sm:h-[440px]"
                style={{ aspectRatio: "9 / 19.5" }}
                aria-label="Hear Oracle say hello"
              >
                <img src={portrait} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <video
                  key={soundOn ? "greet" : "idle"}
                  src={soundOn ? greetingClip : listeningClip}
                  autoPlay
                  muted={!soundOn}
                  loop={!soundOn}
                  playsInline
                  preload="metadata"
                  onEnded={() => setSoundOn(false)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {!soundOn && (
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-background/90 to-transparent pb-4 pt-12 text-sm font-medium">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Play className="h-4 w-4 fill-current" /></span>
                    Hear her say hello
                  </span>
                )}
                {soundOn && <Volume2 className="absolute right-3 top-3 h-5 w-5 text-primary" />}
              </button>
              {SCREENSHOTS.map((s, i) => (
                <button
                  key={s.alt}
                  type="button"
                  onClick={() => setViewer(i)}
                  className="h-[380px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border/60 sm:h-[440px]"
                  style={{ aspectRatio: "390 / 844" }}
                >
                  <img src={s.src} alt={s.alt} loading="lazy" className="h-full w-full object-cover object-top" />
                </button>
              ))}
            </div>
          </section>

          {/* About */}
          <section className="mt-8">
            <button type="button" onClick={() => setAboutOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
              <h2 className="text-lg font-semibold">About this app</h2>
              <ArrowRight className={`h-5 w-5 text-muted-foreground transition-transform ${aboutOpen ? "rotate-90" : ""}`} />
            </button>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Meet Oracle — a warm, happy AI friend who chats with you by voice or text, remembers what matters to you and helps
              with almost anything: writing stories, making pictures and videos, planning your day, learning something new or
              just talking things through.
            </p>
            {aboutOpen && (
              <div className="mt-4 space-y-4 text-sm text-muted-foreground animate-fade-in">
                <p>Everything lives in one app, so you don't need ten different ones. Start free, then upgrade only if you want Oracle's AI tools.</p>
                <ul className="space-y-2">
                  {[
                    "Talk to Oracle with her premium voice, and change her look and outfits",
                    "Story Writer, photo, image, music and sound tools",
                    "Movie Studio, AI video and the App Builder on Pro",
                    "Calendar, diary, reminders and your private Library",
                    "Crisis Hub and safety pages — always free",
                    "Creator Shop to buy and sell templates",
                  ].map((f) => (
                    <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>
                  ))}
                </ul>
                <p className="text-xs">Oracle is an AI, not a person. Presenter footage is AI-generated.</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <span key={t} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{t}</span>
              ))}
            </div>
          </section>

          {/* What's new */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">What's new</h2>
            <p className="mt-1 text-xs text-muted-foreground">Updated November 2026</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {WHATS_NEW.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          </section>

          {/* Data safety */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Data safety</h2>
            <p className="mt-1 text-sm text-muted-foreground">Oracle is built to care for you, not to watch you.</p>
            <div className="mt-4 space-y-4 rounded-xl border border-border/60 bg-card/40 p-4 text-sm">
              {[
                { icon: ShieldCheck, title: "Your personal data is not sold", body: "See our privacy policy for the few trusted services that help run the app." },
                { icon: Sparkles, title: "Mood reading stays on your device", body: "Oracle notices how you feel during a chat, but that is never saved." },
                { icon: Lock, title: "Private account and encrypted connection", body: "Sign-in is required and your creations stay in your own account." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div><div className="font-medium">{title}</div><div className="text-muted-foreground">{body}</div></div>
                </div>
              ))}
              <Link to="/privacy-policy" className="inline-block text-sm font-medium text-primary hover:underline">See details</Link>
            </div>
          </section>
        </div>

        {/* Side column (below on phones) */}
        <aside className="mt-8 space-y-8 lg:mt-0">
          <section>
            <h2 className="text-lg font-semibold">Plans</h2>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                <div className="flex items-baseline justify-between"><span className="font-semibold">Free</span><span className="text-sm">A$0</span></div>
                <p className="mt-1 text-xs text-muted-foreground">{FREE_FEATURES.slice(0, 3).join(" · ")}</p>
              </div>
              {(["plus", "pro"] as const).map((id) => (
                <div key={id} className="rounded-xl border border-primary/40 bg-card/40 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold text-primary">{PLANS[id].name}</span>
                    <span className="text-sm">A${PLANS[id].monthlyAud}/mo</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{PLANS[id].tagline}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Pay yearly and get 2 months free. Cancel any time.</p>
            </div>
          </section>

          <section>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <h2 className="text-lg font-semibold">App support</h2>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                <a href="mailto:support@oracle-lunar.online" className="flex items-center gap-3 text-muted-foreground hover:text-foreground">
                  <Mail className="h-4 w-4 text-primary" />support@oracle-lunar.online
                </a>
                <Link to="/privacy-policy" className="flex items-center gap-3 text-muted-foreground hover:text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />Privacy policy
                </Link>
                <Link to="/terms-of-service" className="flex items-center gap-3 text-muted-foreground hover:text-foreground">
                  <Lock className="h-4 w-4 text-primary" />Terms of service
                </Link>
              </div>
            </details>
          </section>
        </aside>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Oracle is an AI. Presenter footage is AI-generated. ·{" "}
        <Link to="/ad" className="hover:underline">Watch the ad</Link>
      </footer>

      {/* Bottom install bar */}
      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md animate-fade-in" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <img src={appIcon} alt="" className="h-10 w-10 rounded-[22%]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">Oracle Lunar</div>
              <div className="truncate text-xs text-muted-foreground">Free · In-app purchases</div>
            </div>
            <Button onClick={handleInstall} className="font-semibold"><Download className="mr-1.5 h-4 w-4" />{installLabel}</Button>
          </div>
        </div>
      )}

      {/* Screenshot viewer */}
      <Dialog open={viewer !== null} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-[min(420px,92vw)] border-border bg-background p-2">
          <DialogTitle className="sr-only">Screenshot</DialogTitle>
          {viewer !== null && (
            <img src={SCREENSHOTS[viewer].src} alt={SCREENSHOTS[viewer].alt} className="max-h-[85vh] w-full rounded-xl object-contain" />
          )}
        </DialogContent>
      </Dialog>

      <InstallHelpDialog open={helpOpen} onOpenChange={setHelpOpen} platform={platform} />
      <ApkDownloadDialog open={apkOpen} onOpenChange={setApkOpen} downloadStarted />
    </div>
  );
}

function InstallHelpDialog({ open, onOpenChange, platform }: { open: boolean; onOpenChange: (o: boolean) => void; platform: Platform }) {
  const inApp = isInAppBrowser();
  const steps: string[] = inApp
    ? [
        "This page is open inside another app, which can't install apps.",
        platform === "ios" ? "Tap ••• or the share icon, then choose \"Open in Safari\"." : "Tap ⋮ then choose \"Open in Chrome\" (or your browser).",
        "Press Install again on this page.",
      ]
    : platform === "ios"
      ? [
          "Open this page in Safari.",
          "Tap the Share button (the square with an arrow) at the bottom.",
          "Scroll down and tap \"Add to Home Screen\", then tap Add.",
          "Oracle Lunar now sits with your apps — tap her icon to open.",
        ]
      : platform === "android"
        ? [
            "Open this page in Chrome.",
            "Tap the ⋮ menu at the top right.",
            "Tap \"Install app\" (or \"Add to Home screen\"), then Install.",
            "Oracle Lunar now sits with your apps — tap her icon to open.",
          ]
        : [
            "Use Chrome or Edge on your computer.",
            "Click the install icon at the right end of the address bar — or open the ⋮ menu and choose \"Install Oracle Lunar\".",
            "On a Mac with Safari: File menu → \"Add to Dock\".",
            "Oracle Lunar opens in its own window, like any other app.",
          ];

  const copy = async () => {
    try { await navigator.clipboard.writeText(PUBLIC_URL); toast.success("Link copied"); } catch { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" />Install Oracle Lunar</DialogTitle>
          <DialogDescription>It takes about 10 seconds and doesn't use much space.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex gap-2">
          {inApp && <Button variant="outline" className="flex-1" onClick={copy}>Copy link</Button>}
          <Button className="flex-1" onClick={() => onOpenChange(false)}><X className="mr-1.5 h-4 w-4" />Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
