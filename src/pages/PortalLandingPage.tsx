import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield as AdminShield } from "lucide-react";
import SEO from "@/components/SEO";
import HomepageMailbox from "@/components/HomepageMailbox";
import { useSubscription } from "@/hooks/useSubscription";

const HOME_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ORACLE LUNAR — AI Companion Super App",
    "operatingSystem": "Android, iOS, Web",
    "applicationCategory": "LifestyleApplication",
    "url": "https://oracle-lunar.online/",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "ratingCount": "127" },
    "screenshot": "https://oracle-lunar.online/icons/icon-512.png",
    "featureList": "Oracle AI voice chat, Crisis Hub, Mind Hub, AI Companion, Photography Hub, Live Vision, Movie Studio, Voice Studio, AI Tutor, Marketing Hub, App Builder",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "Is ORACLE LUNAR free?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — joining is free and new members get one-time welcome coins. Paid AI actions use coins, with no subscription tiers." } },
      { "@type": "Question", "name": "Is ORACLE LUNAR a ChatGPT alternative?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. ORACLE LUNAR includes a free voice AI chat, AI tutor, AI photo editor, AI movie studio and 40+ tools — going far beyond a single chatbot." } },
      { "@type": "Question", "name": "Does ORACLE LUNAR work on Android and iPhone?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Install as a PWA on iPhone or Android, or download the Android APK directly from the homepage." } },
      { "@type": "Question", "name": "Can the AI remember me?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — every Oracle session uses persistent memory so the AI remembers your preferences, history and personality." } },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://oracle-lunar.online/" },
    ],
  },
];
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
import oracleLunarBanner from "@/assets/oracle-lunar-banner.jpg";
import oracleLunarLogo from "@/assets/oracle-lunar-logo.png";
import webWrapperLogo from "@/assets/web-wrapper-logo.png";
import VisitorCounter from "@/components/VisitorCounter";
import MlscLogo from "@/components/MlscLogo";
import { trackInstallEvent, detectInstallPlatform, type InstallPlatform } from "@/lib/installAnalytics";
import { bounceIfNotProduction, getNativeStoreUrl } from "@/lib/installRedirect";

const FEATURES = [
  // Oracle is intentionally NOT shown on the public portal — members only.
  { icon: Heart, title: "Crisis Hub", desc: "Safety-first crisis support tools — free for everyone, no paywall, ever.", to: "/crisis-hub" },
  { icon: Brain, title: "Mind Hub", desc: "8 guided wellness exercises with AI voice guidance and mood tracking.", to: "/mind-hub" },
  { icon: Camera, title: "Photography Hub", desc: "AI image-to-image transforms — restyle, age, restore, fantasy worlds.", to: "/photography-hub" },
  { icon: Eye, title: "Live Vision", desc: "Real-time camera analysis powered by Gemini Flash — describe, translate, identify.", to: "/live-vision" },
  { icon: Mic, title: "Voice Studio", desc: "120+ pro voice profiles plus voice cloning on premium tiers.", to: "/voice-studio" },
  { icon: Users, title: "AI Companion", desc: "M-rated personalized partner persona with deep memory and personality.", to: "/ai-companion" },
  { icon: Wand2, title: "Magic Hub", desc: "AI art generator, story writer, color magician and image transformations.", to: "/magic-hub" },
  { icon: Megaphone, title: "Marketing Hub", desc: "SEO Dominator, Ad Creator Pro and outreach tools to grow your brand.", to: "/marketing-hub" },
  { icon: Video, title: "Video Editor", desc: "AI-assisted timeline editor with transitions, captions and music.", to: "/video-editor" },
  // Movie Studio Pro temporarily removed — under construction. Oracle handles requests via external tools.
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
];

const PortalLandingPage = () => {
  const navigate = useNavigate();
  const { canInstall, isIOS, isStandalone, install } = usePWAInstall();
  const { user } = useAuth();
  const { subscribed } = useSubscription();
  const isAdmin = user?.email?.toLowerCase() === "justinbretthogan@gmail.com";
  const isMember = !!user && (subscribed || isAdmin);

  const handleTileClick = (to: string) => {
    // Coin economy: any signed-in user can enter every app. Paid AI calls deduct coins server-side.
    if (user) {
      if (bounceIfNotProduction(to)) return;
      navigate(to);
    } else {
      // Soft-lock: anonymous visitors trigger auth on any action.
      const target = `/sign-in?mode=signup&redirect=${encodeURIComponent(to)}`;
      if (bounceIfNotProduction(target)) return;
      navigate(target);
    }
  };

  const goMemberSignIn = (redirect = "/dashboard") => {
    const target = `/sign-in?redirect=${encodeURIComponent(redirect)}`;
    if (bounceIfNotProduction(target)) return;
    navigate(target);
  };

  const goMemberSignUp = (redirect = "/dashboard") => {
    const target = `/sign-in?mode=signup&redirect=${encodeURIComponent(redirect)}`;
    if (bounceIfNotProduction(target)) return;
    navigate(target);
  };

  const goOwnerSignIn = () => {
    const target = `/sign-in?redirect=${encodeURIComponent("/owner-dashboard")}`;
    if (bounceIfNotProduction(target)) return;
    navigate(target);
  };

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
    trackInstallEvent("click", platform);

    // 0) If a real native store listing exists, that IS the actual app — never
    //    fall back to the PWA shortcut path which can look like "downloading
    //    the website" to non-technical users.
    const storeUrl = getNativeStoreUrl();
    if (storeUrl) {
      window.open(storeUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // If we're inside the Lovable editor iframe or on a preview/sandbox URL,
    // PWA install can NEVER work here — the manifest's start_url belongs to the
    // production domain. Send the user there immediately so install actually works.
    if (bounceIfNotProduction("/")) return;

    // Force registration before allowing the app to be downloaded/installed.
    if (!user) {
      goMemberSignIn("/");
      return;
    }

    const outcome = await install();
    if (outcome === "unavailable") {
      // iOS Safari + browsers without beforeinstallprompt — guide the user.
      if (platform === "ios" || isIOS) {
        alert(
          "To install ORACLE LUNAR on iPhone/iPad:\n\n" +
          "1. Tap the Share icon at the bottom of Safari.\n" +
          "2. Scroll down and choose 'Add to Home Screen'.\n" +
          "3. Tap 'Add' — done!"
        );
      } else if (platform === "android") {
        alert(
          "To install on Android:\n\n" +
          "1. Open this page in Chrome.\n" +
          "2. Tap the ⋮ menu (top-right).\n" +
          "3. Choose 'Install app' or 'Add to Home screen'."
        );
      } else {
        document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <SEO
        title="Free AI Companion, Voice Chat, Mind & Wellness Super App"
        description="ORACLE LUNAR — free all-in-one AI super app: voice Oracle, AI companion, crisis hub, mind & wellness, AI photo editor, movie studio, AI tutor & 40+ tools. Install free."
        path="/"
        jsonLd={HOME_JSON_LD}
      />

      {/* ── Top nav ───────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img src={oracleLunarLogo} alt="ORACLE LUNAR logo" className="h-9 w-9 shrink-0 drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
            <span className="oracle-lunar-wordmark text-lg whitespace-nowrap">ORACLE LUNAR</span>
            {/* Rainbow MLSC sound-layering badge — sits to the right of the wordmark */}
            <MlscLogo size="md" showLabel className="shrink-0 ml-1" />
          </div>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#all-apps" className="hover:text-primary transition-colors">All Apps</a>
            <button
              type="button"
              onClick={() => navigate("/library/public")}
              className="hover:text-primary transition-colors font-semibold text-primary/90"
            >
              Public Library
            </button>
            <a href="#install" className="hover:text-primary transition-colors">Install</a>
            <button type="button" onClick={() => goMemberSignUp("/wallet")} className="hover:text-primary transition-colors">Coins</button>
            <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
            <button
              type="button"
              onClick={() => navigate(user ? "/owner-dashboard" : (goOwnerSignIn(), "/"))}
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
              aria-label="Owner access"
            >
              <AdminShield className="h-3.5 w-3.5" /> Owner
            </button>
          </nav>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => goMemberSignIn("/dashboard")}
              variant="outline"
              size="sm"
              aria-label="Member sign in"
            >
              <span className="hidden sm:inline">Member Sign In</span>
              <span className="sm:hidden">Sign In</span>
            </Button>
            <Button
              onClick={() => goMemberSignUp("/dashboard")}
              variant="default"
              size="sm"
              aria-label="Member sign up"
            >
              <span className="hidden sm:inline">Member Sign Up</span>
              <span className="sm:hidden">Sign Up</span>
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
              Your AI companion — always here for you 💛
            </span>
          </h1>

          <div className="flex justify-center mb-6">
            <VisitorCounter page="landing" />
          </div>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Talk, listen, create and unwind with an AI that genuinely cares — wellness, creativity,
            safety and productivity in one cinematic super-app.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => goMemberSignUp("/dashboard")}
              className="h-16 px-10 text-lg font-bold rounded-2xl shadow-[0_0_50px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_80px_hsl(var(--primary)/0.9)] hover:scale-105 transition-all"
            >
              <Sparkles className="mr-3 h-7 w-7" />
              Start Chatting Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => goMemberSignIn("/dashboard")}
              className="h-16 px-10 text-lg font-bold rounded-2xl border-2 border-primary/40 hover:border-primary"
            >
              <Lock className="mr-3 h-6 w-6" />
              Sign In
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Continue with email and password — free to join, coins only when paid AI actions are used.
          </p>

          <p className="mt-4 text-xs text-muted-foreground">
            ⚡ Installs in 5 seconds · No app store needed · Works on iPhone, Android & Desktop
          </p>

          <div className="mt-10 flex justify-center">
            <SecurityShield />
          </div>
        </div>
      </section>



      {/* "Why people love" 3-card section removed per owner request. */}

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
                onClick={() => handleTileClick(feature.to)}
                className="holo-tile rounded-xl p-5 text-left hover:ring-2 hover:ring-primary/60 transition-all relative"
                aria-label={isMember ? `Open ${title}` : `Sign in to use ${title}`}
              >
                <Icon className="holo-icon h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1 text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                {!isMember && (
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <Lock className="w-3 h-3" /> {user ? "Upgrade to unlock" : "Sign up to unlock"}
                  </span>
                )}
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

            {/* Public Library — every creation by every member */}
            <div className="holo-tile rounded-2xl p-6 border border-primary/30 shadow-[0_0_40px_hsl(var(--primary)/0.15)] flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center drop-shadow-[0_0_20px_hsl(var(--primary)/0.6)]">
                  <AdminShield className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-xl text-foreground">Public Library</h3>
                  <p className="text-xs text-primary uppercase tracking-wider">Browse · Download · Buy</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                Explore every photo, GIF, movie, and app shared by Oracle Lunar members.
                Members can download anything for free, or buy creator-priced items in the Creators Shop.
              </p>
              <button
                onClick={() => navigate("/library/public")}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-primary text-primary-foreground font-semibold shadow-[0_0_30px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_50px_hsl(var(--primary)/0.6)] transition-shadow"
              >
                Open Public Library
              </button>
            </div>

            {/* Movie Studio Pro & Living GIF — temporarily under construction */}
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
                badge: "Native Play Store app coming soon",
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
                  // Bounce out of the editor iframe if we're not on production —
                  // otherwise the share sheet shows the preview URL.
                  if (bounceIfNotProduction("/")) return;
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
                {cards.map(({ key, icon: Icon, title, steps, cta, action, installedHere, badge }: any) => (
                  <div key={key} className="holo-tile rounded-xl p-6 flex flex-col">
                    <Icon className="holo-icon h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-2 text-foreground">{title}</h3>
                    <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside flex-1">
                      {steps.map((s: string) => <li key={s}>{s}</li>)}
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
                    {badge && (
                      <p className="text-[10px] uppercase tracking-wider text-primary/80 text-center mt-2 font-semibold">
                        🎉 {badge}
                      </p>
                    )}
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


            {/* App Wrapper CTA removed from public Portal — admin-only via Owner Dashboard */}

            <p className="text-xs text-muted-foreground mt-3">
              📱 Native Android app <strong className="text-primary">coming soon to Google Play</strong> — install as a PWA above to use ORACLE LUNAR right now.
            </p>
          </div>
        </div>
      </section>

      {/* ── Direct mailbox to admin ─────────── */}
      <HomepageMailbox />

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
              onClick={() => {
                if (user) {
                  navigate("/owner-dashboard");
                  return;
                }
                goOwnerSignIn();
              }}
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



      {/* Portal tiles never render live previews — they always route to sign-in or into the app. */}
    </div>
  );
};

export default PortalLandingPage;
