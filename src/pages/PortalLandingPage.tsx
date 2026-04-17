import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import PortalTutorWidget from "@/components/PortalTutorWidget";
import SecurityShield from "@/components/SecurityShield";
import solaceBanner from "@/assets/solace-banner.jpg";
import solaceLogo from "@/assets/solace-logo.png";

const FEATURES = [
  { icon: Sparkles, title: "Oracle AI", desc: "A personal AI guide that talks, listens, and remembers — with optional orbiting AI friends." },
  { icon: Heart, title: "Crisis Hub", desc: "Safety-first crisis support tools — free for everyone, no paywall, ever." },
  { icon: Brain, title: "Mind Hub", desc: "8 guided wellness exercises with AI voice guidance and mood tracking." },
  { icon: Camera, title: "Photography & Live Vision", desc: "AI image transforms and real-time camera analysis powered by Gemini." },
  { icon: Mic, title: "Voice Studio", desc: "120+ pro voice profiles plus voice cloning on premium tiers." },
  { icon: Users, title: "AI Companion", desc: "M-rated personalized partner personas with deep memory and personality." },
  { icon: Wand2, title: "Magic & Marketing Hubs", desc: "AI art, story writing, SEO domination, and ad creation tools in one place." },
  { icon: Shield, title: "AI Security Fortress", desc: "101 AI security guards plus DB-level protections keep your data locked down." },
  { icon: Smartphone, title: "Web Wrapper", desc: "Turn any website into a Play Store-ready Android app — paste a URL, get an APK package.", to: "/web-wrapper" },
];

const PortalLandingPage = () => {
  const navigate = useNavigate();
  const { canInstall, isIOS, isStandalone, install } = usePWAInstall();

  const handleInstall = async () => {
    const outcome = await install();
    if (outcome === "unavailable") {
      document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top nav ───────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={solaceLogo} alt="SOLACE logo" className="h-9 w-9 drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
            <span className="font-bold text-lg tracking-[0.2em] text-primary">SOLACE</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#install" className="hover:text-primary transition-colors">Install</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
          </nav>
          <Button onClick={() => navigate("/welcome")} variant="default" size="sm">
            Launch App <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Hero (mirrors IntroSplash) ────────── */}
      <section className="relative overflow-hidden">
        {/* Banner image — same as the app's IntroSplash */}
        <img
          src={solaceBanner}
          alt="SOLACE cinematic banner"
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
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-3xl animate-pulse" />
              <img
                src={solaceLogo}
                alt="SOLACE shield logo"
                className="relative h-32 w-32 md:h-40 md:w-40 drop-shadow-[0_0_40px_hsl(var(--primary)/0.8)] animate-glow-pulse"
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/80 backdrop-blur px-4 py-1.5 text-xs text-muted-foreground mb-6">
            <Zap className="h-3.5 w-3.5 text-primary" />
            40+ AI modules · One cinematic super-app
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 drop-shadow-lg">
            <span className="text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">SOLACE</span>
            <br />
            <span className="text-foreground text-3xl md:text-5xl font-medium">
              Your AI companion to do everything
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Wellness, creativity, safety, and productivity — unified in one cinematic experience,
            guided by an AI that talks, listens, and genuinely cares.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={handleInstall}
              disabled={isStandalone}
              className="shadow-[0_0_40px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_60px_hsl(var(--primary)/0.7)] transition-shadow"
            >
              <Download className="mr-2 h-5 w-5" />
              {isStandalone ? "Already installed" : canInstall ? "Install SOLACE" : "How to install"}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/welcome")} className="border-primary/40 hover:border-primary">
              Try it in your browser <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="mt-10 flex justify-center">
            <SecurityShield />
          </div>
        </div>
      </section>

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
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="holo-tile rounded-xl p-5 text-left">
              <Icon className="holo-icon h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1 text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
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
              SOLACE installs straight from your browser — no app store, no waiting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { icon: Smartphone, title: "Android", steps: ["Open in Chrome or Edge.", "Tap Install SOLACE above.", "Confirm in the prompt."] },
              { icon: Apple, title: "iPhone / iPad", steps: ["Open in Safari.", "Tap the Share icon.", "Choose Add to Home Screen."] },
              { icon: Monitor, title: "Desktop", steps: ["Use Chrome, Edge, or Brave.", "Click the install icon in the address bar.", "Or hit Install above."] },
            ].map(({ icon: Icon, title, steps }) => (
              <div key={title} className="holo-tile rounded-xl p-6">
                <Icon className="holo-icon h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2 text-foreground">{title}</h3>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  {steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button
              size="lg"
              onClick={handleInstall}
              disabled={isStandalone}
              className="shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
            >
              <Download className="mr-2 h-5 w-5" />
              {isStandalone ? "Already installed ✓" : isIOS ? "See iOS steps above" : canInstall ? "Install SOLACE now" : "Install (use Chrome/Edge/Safari)"}
            </Button>
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
            Crisis support and the Oracle are always free. Premium tiers unlock the full studio.
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
              { q: "Do I need to download from an app store?", a: "Not yet. SOLACE installs as a Progressive Web App straight from your browser. Native store builds are in progress." },
              { q: "Is my data safe?", a: "Yes. SOLACE uses row-level security on every table and 101 AI security guards monitor for anomalies. Your conversations stay yours." },
              { q: "Will the AI replace therapy or emergency services?", a: "No. SOLACE supports your wellbeing, but the Crisis Hub always points to local emergency services and trained professionals when needed." },
              { q: "Can I try it before installing?", a: "Yes — tap 'Launch App' to use SOLACE in your browser. Install later if you want it on your home screen." },
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
            <img src={solaceLogo} alt="SOLACE" className="h-7 w-7 drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
            <span>© {new Date().getFullYear()} SOLACE. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="/privacy-policy" className="hover:text-primary">Privacy</a>
            <a href="/terms-of-service" className="hover:text-primary">Terms</a>
            <a href="/about" className="hover:text-primary">About</a>
            <span className="inline-flex items-center gap-1 text-xs">
              <Lock className="h-3.5 w-3.5" /> AI Anti-Hacker Active
            </span>
          </div>
        </div>
      </footer>

      <PortalTutorWidget />
    </div>
  );
};

export default PortalLandingPage;
