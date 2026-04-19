import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield as AdminShield } from "lucide-react";
import FeaturePreviewDialog from "@/components/FeaturePreviewDialog";
import {
  Shield,
  Sparkles,
  Heart,
  Brain,
  Camera,
  Users,
  Mic,
  Wand2,
  Smartphone,
  Apple,
  Monitor,
  CheckCircle2,
  ArrowRight,
  Download,
  Lock,
  Zap,
  Eye,
  Video,
  Film,
  Wallet,
  Calendar,
  GraduationCap,
  Languages,
  Lightbulb,
  Megaphone,
  Briefcase,
  HeartHandshake,
  Pill,
  ShoppingBag,
  Wrench,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import SecurityShield from "@/components/SecurityShield";
import StickyInstallBar from "@/components/StickyInstallBar";
import SocialProofBar from "@/components/SocialProofBar";
import PartyBanner from "@/components/PartyBanner";
import ExitIntentCapture from "@/components/ExitIntentCapture";
import oracleLunarBanner from "@/assets/oracle-lunar-banner.jpg";
import oracleLunarLogo from "@/assets/oracle-lunar-logo.png";
import webWrapperLogo from "@/assets/web-wrapper-logo.png";
import VisitorCounter from "@/components/VisitorCounter";
import { trackInstallEvent, detectInstallPlatform, type InstallPlatform } from "@/lib/installAnalytics";

const FEATURES = [
  { icon: Sparkles, title: "Oracle AI", desc: "A personal AI guide that talks, listens, and remembers — with optional orbiting AI friends.", to: "/oracle" },
  { icon: Heart, title: "Crisis Hub", desc: "Safety-first crisis support tools — free for everyone, no paywall, ever.", to: "/crisis-hub" },
  { icon: Brain, title: "Mind Hub", desc: "8 guided wellness exercises with AI voice guidance and mood tracking.", to: "/mind-hub" },
  { icon: Camera, title: "Photography Hub", desc: "AI image-to-image transforms — restyle, age, restore, fantasy worlds.", to: "/photography-hub" },
  { icon: Eye, title: "Live Vision", desc: "Real-time camera analysis powered by Gemini Flash — describe, translate, identify.", to: "/live-vision" },
  { icon: Mic, title: "Voice Studio", desc: "120+ pro voice profiles plus voice cloning on premium tiers.", to: "/voice-studio" },
  { icon: Users, title: "AI Companion", desc: "M-rated personalized partner persona with deep memory and personality.", to: "/ai-companion" },
  { icon: Wand2, title: "Magic Hub", desc: "AI art generator, story writer, color magician and image transformations.", to: "/magic-hub" },
  { icon: Megaphone, title: "Marketing Hub", desc: "SEO Dominator, Ad Creator Pro and outreach tools to grow your brand.", to: "/marketing-hub" },
  { icon: Video, title: "Video Editor", desc: "AI-assisted timeline editor with transitions, captions and music.", to: "/video-editor" },
  { icon: Film, title: "Movie Studio Pro", desc: "Full cinematic editor — script→scenes, voiceover, music, SFX, captions, HD export.", to: "/movie-studio-pro" },
  { icon: Wallet, title: "Wallet & Bills", desc: "BPAY, PayID, AI Accountant chat and automated bill pay.", to: "/wallet" },
  { icon: Calendar, title: "Calendar & Diary", desc: "Life Diary, mood-aware journal entries and AI-powered reminders.", to: "/calendar" },
  { icon: GraduationCap, title: "AI Tutor", desc: "Personal tutor that adapts to any subject and your learning style.", to: "/ai-tutor" },
  { icon: Languages, title: "Interpreter", desc: "Real-time two-way voice translation across dozens of languages.", to: "/interpreter" },
  { icon: Lightbulb, title: "Inventor Lab", desc: "AI brainstorming partner that turns half-ideas into real products.", to: "/inventor" },
  { icon: Briefcase, title: "Professional Hub", desc: "Live AI mock interviews, résumé feedback and career coaching.", to: "/professional-hub" },
  { icon: HeartHandshake, title: "Family Hub", desc: "Shared calendars, kid-safe AI and a private family activity feed.", to: "/family-hub" },
  { icon: Pill, title: "Elderly Care", desc: "Medication reminders, fall alerts and gentle daily check-ins.", to: "/elderly-care" },
  { icon: Gift, title: "Special Occasions", desc: "Never miss a birthday, anniversary or important date — AI plans it.", to: "/special-occasions" },
  { icon: ShoppingBag, title: "POS Learn", desc: "16-lesson curriculum to master point-of-sale and retail tech.", to: "/pos-learn" },
  { icon: Wand2, title: "App Builder", desc: "Conversational generator — describe an app, export a working PWA.", to: "/app-builder" },
  { icon: Shield, title: "AI Security Fortress", desc: "101 AI security guards plus DB-level protections keep your data locked down.", to: "/safety-center" },
  { icon: Smartphone, title: "App Wrapper", desc: "Wrap any app ready for the Play Store — paste a URL, get a signed APK package.", to: "/web-wrapper" },
];

const PortalLandingPage = () => {
  const navigate = useNavigate();
  const { canInstall, isIOS, isStandalone, install } = usePWAInstall();
  const { user } = useAuth();
  const [previewFeature, setPreviewFeature] = useState<typeof FEATURES[number] | null>(null);

  // Pulse the shield-shaped logo glow while the user is typing in the chat
  useEffect(() => {
    const el = document.getElementById("oracle-lunar-home-logo-glow");
    if (!el) return;
    let timer: number | undefined;
    const onTyping = () => {
      el.classList.add("is-pulsing");
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => el.classList.remove("is-pulsing"), 900);
    };
    window.addEventListener("oracle-lunar-chat-typing", onTyping);
    return () => {
      window.removeEventListener("oracle-lunar-chat-typing", onTyping);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Tag the body so landing-page-only CSS (like the ORACLE LUNAR wordmark headings) activates
  useEffect(() => {
    document.body.setAttribute("data-route", "/");
    return () => { document.body.removeAttribute("data-route"); };
  }, []);

  // Track successful PWA installs (fires once when the browser finishes installing)
  useEffect(() => {
    const onInstalled = () => trackInstallEvent("installed");
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const handleInstall = async (platform: InstallPlatform = detectInstallPlatform()) => {
    // Force registration before allowing the app to be downloaded/installed.
    if (!user) {
      navigate("/sign-in?redirect=/");
      return;
    }
    trackInstallEvent("click", platform);
    const outcome = await install();
    if (outcome === "unavailable") {
      document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Sticky Install Mega-Bar (BOOSTER #1) ── */}
      <StickyInstallBar />

      {/* ── Limited-time free offer bubble (top-left, round, neon-pink) ── */}
      <button
        type="button"
        onClick={() => handleInstall()}
        className="holo-bubble absolute top-20 left-4 z-30 h-36 w-36 md:h-44 md:w-44 rounded-full border-[3px] border-yellow-400 backdrop-blur-md flex flex-col items-center justify-center text-center px-4 shadow-[0_0_40px_rgba(255,20,147,0.85),0_0_80px_rgba(250,204,21,0.5)] hover:shadow-[0_0_60px_rgba(255,20,147,1),0_0_120px_rgba(250,204,21,0.7)] transition-all"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #ff1493 0%, #c2185b 45%, #1a0008 85%, #000 100%)",
          fontFamily: "'Pacifico', 'Caveat', 'Comic Sans MS', cursive",
        }}
        aria-label="Limited time free — install ORACLE LUNAR"
      >
        {/* 🐰 Easter bunny ears */}
        <span aria-hidden="true" className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
          <span className="block w-5 h-12 md:w-6 md:h-14 rounded-full bg-gradient-to-b from-pink-200 to-pink-400 border-2 border-white/80 -rotate-[18deg] shadow-[0_0_12px_rgba(255,182,193,0.9)] relative">
            <span className="absolute inset-x-1 top-2 bottom-3 rounded-full bg-pink-300/80" />
          </span>
          <span className="block w-5 h-12 md:w-6 md:h-14 rounded-full bg-gradient-to-b from-pink-200 to-pink-400 border-2 border-white/80 rotate-[18deg] shadow-[0_0_12px_rgba(255,182,193,0.9)] relative">
            <span className="absolute inset-x-1 top-2 bottom-3 rounded-full bg-pink-300/80" />
          </span>
        </span>
        <span className="holo-rim" aria-hidden="true" />
        <span className="holo-sheen" aria-hidden="true" />
        <span className="holo-scan" aria-hidden="true" />
        <span className="relative z-10 contents">
          <div className="text-2xl md:text-3xl tracking-wide text-yellow-300 leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
            🎉 FREE!
          </div>
          <div className="text-sm md:text-base text-white leading-tight mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            Join the party ✨
          </div>
          <div className="text-xl md:text-2xl text-yellow-300 mt-1 leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
            14 days! 🥳
          </div>
          <div className="text-[11px] md:text-xs text-white/95 mt-1 underline">
            Tap to install 🎈
          </div>
        </span>
      </button>

      {/* ── Referral programme bubble (top-right, round, fluro green) ── */}
      <button
        type="button"
        onClick={() => navigate(user ? "/referrals" : "/sign-in?redirect=/referrals")}
        className="holo-bubble absolute top-20 right-4 z-30 h-36 w-36 md:h-44 md:w-44 rounded-full border-[3px] border-yellow-400 backdrop-blur-md flex flex-col items-center justify-center text-center px-4 shadow-[0_0_40px_rgba(57,255,20,0.85),0_0_80px_rgba(163,255,0,0.5)] hover:shadow-[0_0_60px_rgba(57,255,20,1),0_0_120px_rgba(163,255,0,0.7)] transition-all"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #39ff14 0%, #00b300 45%, #001a00 85%, #000 100%)",
          fontFamily: "'Pacifico', 'Caveat', 'Comic Sans MS', cursive",
        }}
        aria-label="Refer a friend — get a free month of Tier 3"
      >
        {/* 🐰 Easter bunny ears */}
        <span aria-hidden="true" className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
          <span className="block w-5 h-12 md:w-6 md:h-14 rounded-full bg-gradient-to-b from-lime-100 to-lime-300 border-2 border-white/80 -rotate-[18deg] shadow-[0_0_12px_rgba(163,255,0,0.9)] relative">
            <span className="absolute inset-x-1 top-2 bottom-3 rounded-full bg-lime-200/80" />
          </span>
          <span className="block w-5 h-12 md:w-6 md:h-14 rounded-full bg-gradient-to-b from-lime-100 to-lime-300 border-2 border-white/80 rotate-[18deg] shadow-[0_0_12px_rgba(163,255,0,0.9)] relative">
            <span className="absolute inset-x-1 top-2 bottom-3 rounded-full bg-lime-200/80" />
          </span>
        </span>
        <span className="holo-rim" aria-hidden="true" />
        <span className="holo-sheen" aria-hidden="true" />
        <span className="holo-scan" aria-hidden="true" />
        <span className="relative z-10 contents">
          <div className="text-2xl md:text-3xl tracking-wide text-yellow-300 leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
            🔗 REFER!
          </div>
          <div className="text-sm md:text-base text-white leading-tight mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            Invite a friend 💚
          </div>
          <div className="text-xl md:text-2xl text-yellow-300 mt-1 leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
            1 month free! 🎁
          </div>
          <div className="text-[11px] md:text-xs text-white/95 mt-1 underline">
            Tap to share 🚀
          </div>
        </span>
      </button>

      {/* ── Top nav ───────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={oracleLunarLogo} alt="ORACLE LUNAR logo" className="h-9 w-9 drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
            <span className="oracle-lunar-wordmark text-lg">ORACLE LUNAR</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#all-apps" className="hover:text-primary transition-colors">All Apps</a>
            <a href="#install" className="hover:text-primary transition-colors">Install</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
            <button
              type="button"
              onClick={() => navigate(user ? "/owner-dashboard" : "/sign-in?redirect=/owner-dashboard")}
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
              aria-label="Owner access"
            >
              <AdminShield className="h-3.5 w-3.5" /> Owner
            </button>
          </nav>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button onClick={() => navigate("/welcome")} variant="default" size="sm">
              <span className="hidden sm:inline">Launch App</span>
              <span className="sm:hidden">Launch</span>
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero (mirrors IntroSplash) ────────── */}
      <section className="relative overflow-hidden">
        {/* Banner image — same as the app's IntroSplash */}
        <img
          src={oracleLunarBanner}
          alt="ORACLE LUNAR cinematic banner"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        {/* Gold radial glow overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(var(--primary) / 0.25) 0%, hsl(var(--background) / 0.85) 70%)",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
          {/* Animated golden logo — matches app */}
          <div className="relative flex justify-center mb-6">
            {/* Bright neon-blue base glow (bottom layer) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[-44px] h-36 w-[22rem] md:w-[28rem] rounded-full blur-3xl animate-pulse"
              style={{
                background:
                  "radial-gradient(ellipse at center, #00bfff 0%, rgba(0,191,255,0.85) 30%, rgba(30,144,255,0.4) 60%, transparent 80%)",
                boxShadow:
                  "0 0 80px 25px #00bfff, 0 0 160px 60px rgba(0,191,255,0.55)",
              }}
            />
            {/* Rotating rainbow AI glow (middle layer) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[-28px] h-24 w-64 md:w-80 rounded-full blur-2xl opacity-90 animate-[spin_6s_linear_infinite]"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff0040, #ff8a00, #ffe600, #14ff5e, #00d4ff, #6a00ff, #ff00d4, #ff0040)",
              }}
            />
            {/* Soft outer rainbow halo (top layer, counter-pulse) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[-40px] h-32 w-80 md:w-96 rounded-full blur-3xl opacity-70 animate-pulse"
              style={{
                background:
                  "conic-gradient(from 180deg, #ff00d4, #6a00ff, #00d4ff, #14ff5e, #ffe600, #ff8a00, #ff0040, #ff00d4)",
              }}
            />
            <img
              src={oracleLunarLogo}
              alt="ORACLE LUNAR shield logo"
              className="relative z-10 h-32 w-32 md:h-40 md:w-40 drop-shadow-[0_0_25px_rgba(0,191,255,0.6)]"
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/80 backdrop-blur px-4 py-1.5 text-xs text-muted-foreground mb-6">
            <Zap className="h-3.5 w-3.5 text-primary" />
            40+ AI modules · One cinematic super-app
          </div>

          <h1 className="text-5xl md:text-7xl mb-6">
            <span className="oracle-lunar-wordmark text-5xl md:text-7xl">ORACLE LUNAR</span>
            <br />
            <span className="oracle-lunar-wordmark-soft text-2xl md:text-4xl block mt-4">
              Your AI companion to do everything
            </span>
          </h1>

          <div className="flex justify-center mb-6">
            <VisitorCounter page="landing" />
          </div>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Wellness, creativity, safety, and productivity — unified in one cinematic experience,
            guided by an AI that talks, listens, and genuinely cares.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* MEGA CTA (BOOSTER #4) — 3x bigger, pulsing, gold glow */}
            <Button
              size="lg"
              onClick={() => handleInstall()}
              disabled={isStandalone}
              className="h-16 px-10 text-lg font-bold rounded-2xl shadow-[0_0_50px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_80px_hsl(var(--primary)/0.9)] hover:scale-105 transition-all animate-pulse"
            >
              <Download className="mr-3 h-7 w-7" />
              {isStandalone ? "Already installed ✓" : canInstall ? "Install ORACLE LUNAR — Free" : "Install on my phone"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/welcome")}
              className="h-14 px-8 text-base border-2 border-primary/40 hover:border-primary"
            >
              Try in browser <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            ⚡ Installs in 5 seconds · No app store needed · Works on iPhone, Android & Desktop
          </p>

          <div className="mt-10 flex justify-center">
            <SecurityShield />
          </div>
        </div>
      </section>

      {/* ── Live Social Proof Bar (BOOSTER #3) ── */}
      <SocialProofBar />

      {/* ── Free 14-day download banner ── */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <PartyBanner variant="free-14-days" />
      </div>

      {/* ── Founding Member Banner ── */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <PartyBanner variant="founding-member" />
      </div>


      {/* ── Features (holographic tiles like Dashboard) ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Everything in <span className="text-primary">one place</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tap any tile in the live app to dive in. Here's a taste of what's inside.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature) => {
            const { icon: Icon, title, desc } = feature;
            return (
              <button
                key={title}
                onClick={() => setPreviewFeature(feature)}
                className="holo-tile rounded-xl p-5 text-left hover:ring-2 hover:ring-primary/60 transition-all"
              >
                <Icon className="holo-icon h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1 text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── All Apps (special downloads) ───── */}
      <section id="all-apps" className="border-y border-primary/20 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              All <span className="text-primary">Apps</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Special downloads from the ORACLE LUNAR portal — standalone tools that live alongside the main app.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Web Wrapper — featured special download */}
            <div className="holo-tile rounded-2xl p-6 border border-primary/30 shadow-[0_0_40px_hsl(var(--primary)/0.15)] flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={webWrapperLogo}
                  alt="App Wrapper app logo"
                  width={64}
                  height={64}
                  loading="lazy"
                  className="h-16 w-16 rounded-xl drop-shadow-[0_0_20px_hsl(var(--primary)/0.6)]"
                />
                <div>
                  <h3 className="font-semibold text-xl text-foreground">App Wrapper</h3>
                  <p className="text-xs text-primary uppercase tracking-wider">Special download</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                Wrap any app ready for the Play Store. Paste a URL, name your app, and download
                a signed wrapper package you can publish — all from the ORACLE LUNAR portal.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/web-wrapper")}
                className="shadow-[0_0_30px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_50px_hsl(var(--primary)/0.6)] transition-shadow"
              >
                <Download className="mr-2 h-5 w-5" />
                Download App Wrapper
              </Button>
            </div>

            {/* App Maker — conversational app generator */}
            <div className="holo-tile rounded-2xl p-6 border border-primary/30 shadow-[0_0_40px_hsl(var(--primary)/0.15)] flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center drop-shadow-[0_0_20px_hsl(var(--primary)/0.6)]">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-xl text-foreground">App Maker</h3>
                  <p className="text-xs text-primary uppercase tracking-wider">Build with AI</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                Describe an app in plain English and our AI builds a full single-file web app —
                Stripe paywalls, AI chat, PWA install and sharing baked in. Then send it to App Wrapper to publish.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/app-builder")}
                className="shadow-[0_0_30px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_50px_hsl(var(--primary)/0.6)] transition-shadow"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Open App Maker
              </Button>
            </div>

            {/* Movie Studio Pro — paid standalone app */}
            <div className="holo-tile rounded-2xl p-6 border border-primary/30 flex flex-col bg-gradient-to-br from-primary/10 to-transparent">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-xl text-foreground">Movie Studio Pro</h3>
                  <p className="text-xs text-primary uppercase tracking-wider">Pay-per-render · Wallet</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                The full cinematic movie maker — script→scenes, AI voiceover, music & SFX mixing, auto-captions, HD export.
                Build &amp; preview free; only charged from your wallet (compute + 50% service fee, $0.25 minimum) when you export.
                Includes the ORACLE LUNAR AI concierge for guidance.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  onClick={() => navigate("/movie-studio-pro")}
                  className="shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
                >
                  <Sparkles className="mr-2 h-5 w-5" /> Open Studio
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    const url = encodeURIComponent(window.location.origin + "/movie-studio-pro");
                    navigate(`/web-wrapper?url=${url}&name=${encodeURIComponent("Movie Studio Pro")}`);
                  }}
                  className="border-primary/40 hover:border-primary"
                >
                  <Download className="mr-2 h-5 w-5" /> Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Install ───────────────────────────── */}
      <section id="install" className="border-y border-primary/20 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Install in <span className="text-primary">seconds</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              ORACLE LUNAR installs straight from your browser — no app store, no waiting.
            </p>
          </div>

          {(() => {
            // Detect platform so "Already installed" only shows on the matching card,
            // and only when this browser session is actually running the installed PWA.
            const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
            const isAndroidUA = /android/.test(ua);
            const isIOSUA = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
            const isDesktopUA = !isAndroidUA && !isIOSUA;

            const cards = [
              {
                key: "android",
                icon: Smartphone,
                title: "Android",
                steps: ["Open in Chrome or Edge.", "Tap Install below.", "Confirm in the prompt."],
                cta: canInstall ? "Install on Android" : "Open install prompt",
                action: () => handleInstall("android"),
                installedHere: isStandalone && isAndroidUA,
              },
              {
                key: "ios",
                icon: Apple,
                title: "iPhone / iPad",
                steps: ["Open in Safari.", "Tap the Share icon.", "Choose Add to Home Screen."],
                cta: "Show iOS steps",
                action: () => {
                  if ((navigator as any).share) {
                    (navigator as any).share({
                      title: "Install ORACLE LUNAR",
                      text: "Open this in Safari, tap Share, then 'Add to Home Screen' to install ORACLE LUNAR.",
                      url: window.location.origin,
                    }).catch(() => {});
                  } else {
                    alert("On your iPhone or iPad: open this page in Safari → tap the Share icon → choose 'Add to Home Screen'.");
                  }
                },
                installedHere: isStandalone && isIOSUA,
              },
              {
                key: "desktop",
                icon: Monitor,
                title: "Desktop",
                steps: ["Use Chrome, Edge, or Brave.", "Click the install icon in the address bar.", "Or hit the button below."],
                cta: canInstall ? "Install on Desktop" : "Install (Chrome/Edge)",
                action: () => handleInstall("desktop"),
                installedHere: isStandalone && isDesktopUA,
              },
            ];

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                {cards.map(({ key, icon: Icon, title, steps, cta, action, installedHere }) => (
                  <div key={key} className="holo-tile rounded-xl p-6 flex flex-col">
                    <Icon className="holo-icon h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-2 text-foreground">{title}</h3>
                    <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside flex-1">
                      {steps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                    <Button
                      onClick={action}
                      disabled={installedHere}
                      size="sm"
                      className="mt-4 w-full"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {installedHere ? "Already installed ✓" : cta}
                    </Button>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="text-center">
            <Button
              size="lg"
              onClick={() => handleInstall()}
              className="shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
            >
              <Download className="mr-2 h-5 w-5" />
              {isIOS ? "See iOS steps above" : canInstall ? "Install ORACLE LUNAR now" : "Install (use Chrome/Edge/Safari)"}
            </Button>

            {/* Native wrapper download — Portal-specific Play Store package */}
            <div className="mt-8 max-w-2xl mx-auto holo-tile rounded-xl p-6 border border-primary/30">
              <div className="flex items-center gap-3 mb-2 justify-center">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Want the Portal as a real Android app?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Generate a ready-to-publish Google Play Store wrapper for the ORACLE LUNAR Portal in seconds — separate from the main ORACLE LUNAR app.
              </p>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const portalUrl = encodeURIComponent(window.location.origin);
                  navigate(`/web-wrapper?url=${portalUrl}&name=${encodeURIComponent("ORACLE LUNAR Portal")}`);
                }}
                className="border-primary/40 hover:border-primary"
              >
                <Download className="mr-2 h-4 w-4" />
                Build Portal App Wrapper
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Native Android & iOS builds coming soon to Google Play and the App Store.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Free to start. <span className="text-primary">Power when you need it.</span>
          </h2>
          <p className="text-muted-foreground">
            Crisis support and the Oracle are free with daily chat limits — conditions apply.
            Photo &amp; video generation, voice cloning, and other heavy AI features require a paid plan.
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            *Free tier includes a daily message cap on Oracle chat. Premium AI generation
            (images, video, music, cloned voices) is paywalled to cover compute costs.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: "Free", price: "$0", perks: ["Oracle + 1 AI friend", "Crisis Hub & Safety Center", "Suggestion Box", "Always-free core safety"] },
            { name: "Starter", price: "$5/mo", perks: ["Everything in Free", "Mind Hub & Calendar", "Photography Hub basics", "10 premium voices"] },
            { name: "Premium+", price: "Higher tiers", perks: ["All 40+ modules", "Voice cloning + 120 voices", "AI Companion", "Marketing & App Builder"] },
          ].map((tier, i) => (
            <div
              key={tier.name}
              className={`holo-tile rounded-xl p-6 ${i === 1 ? "ring-2 ring-primary shadow-[0_0_40px_hsl(var(--primary)/0.3)]" : ""}`}
            >
              <h3 className="font-semibold text-lg mb-1 text-foreground">{tier.name}</h3>
              <div className="text-3xl font-bold mb-4 text-primary">{tier.price}</div>
              <ul className="space-y-2 text-sm">
                {tier.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{p}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6"
                variant={i === 1 ? "default" : "outline"}
                onClick={() => navigate("/subscribe")}
              >
                {tier.name === "Free" ? "Get started" : "Choose plan"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────── */}
      <section id="faq" className="border-t border-primary/20 bg-card/40">
        <div className="max-w-3xl mx-auto px-4 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">
            Common <span className="text-primary">questions</span>
          </h2>
          <div className="space-y-4">
            {[
              { q: "Do I need to download from an app store?", a: "Not yet. ORACLE LUNAR installs as a Progressive Web App straight from your browser. Native store builds are in progress." },
              { q: "Is my data safe?", a: "Yes. ORACLE LUNAR uses row-level security on every table and 101 AI security guards monitor for anomalies. Your conversations stay yours." },
              { q: "Will the AI replace therapy or emergency services?", a: "No. ORACLE LUNAR supports your wellbeing, but the Crisis Hub always points to local emergency services and trained professionals when needed." },
              { q: "Can I try it before installing?", a: "Yes — tap 'Launch App' to use ORACLE LUNAR in your browser. Install later if you want it on your home screen." },
              { q: "How do I get help?", a: "Tap the Concierge button (bottom right) any time. I can walk you through every feature." },
            ].map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border border-border bg-background/60 backdrop-blur p-5 open:border-primary/40 open:shadow-[0_0_30px_hsl(var(--primary)/0.15)] transition-all"
              >
                <summary className="cursor-pointer font-semibold flex items-center justify-between text-foreground">
                  {q}
                  <span className="text-primary group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────── */}
      <footer className="border-t border-primary/20">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={oracleLunarLogo} alt="ORACLE LUNAR" className="h-7 w-7 drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
            <span>© {new Date().getFullYear()} ORACLE LUNAR. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <a href="/privacy-policy" className="hover:text-primary">Privacy</a>
            <a href="/terms-of-service" className="hover:text-primary">Terms</a>
            <a href="/about" className="hover:text-primary">About</a>
            <button
              type="button"
              onClick={() => navigate(user ? "/owner-dashboard" : "/sign-in?redirect=/owner-dashboard")}
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
              aria-label="Owner access"
              title="Owner access"
            >
              <AdminShield className="h-3.5 w-3.5" />
              <span>Owner</span>
            </button>
            <span className="inline-flex items-center gap-1 text-xs">
              <Lock className="h-3.5 w-3.5" /> AI Anti-Hacker Active
            </span>
          </div>
        </div>
      </footer>

      {/* PortalTutorWidget removed from public site — Oracle is gated behind sign-in + paywall */}

      {/* ── Exit-Intent Email Capture (BOOSTER #5) ── */}
      <ExitIntentCapture />

      {previewFeature && (
        <FeaturePreviewDialog
          open={!!previewFeature}
          onOpenChange={(o) => !o && setPreviewFeature(null)}
          title={previewFeature.title}
          desc={previewFeature.desc}
          icon={previewFeature.icon}
          to={previewFeature.to}
        />
      )}
    </div>
  );
};

export default PortalLandingPage;
