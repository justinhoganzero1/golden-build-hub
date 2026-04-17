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

const FEATURES = [
  { icon: Sparkles, title: "Oracle AI", desc: "A personal AI guide that talks, listens, and remembers — with optional orbiting AI friends." },
  { icon: Heart, title: "Crisis Hub", desc: "Safety-first crisis support tools — free for everyone, no paywall, ever." },
  { icon: Brain, title: "Mind Hub", desc: "8 guided wellness exercises with AI voice guidance and mood tracking." },
  { icon: Camera, title: "Photography & Live Vision", desc: "AI image transforms and real-time camera analysis powered by Gemini." },
  { icon: Mic, title: "Voice Studio", desc: "120+ pro voice profiles plus voice cloning on premium tiers." },
  { icon: Users, title: "AI Companion", desc: "M-rated personalized partner personas with deep memory and personality." },
  { icon: Wand2, title: "Magic & Marketing Hubs", desc: "AI art, story writing, SEO domination, and ad creation tools in one place." },
  { icon: Shield, title: "AI Security Fortress", desc: "101 AI security guards plus DB-level protections keep your data locked down." },
];

const PortalLandingPage = () => {
  const navigate = useNavigate();
  const { canInstall, isIOS, isStandalone, install } = usePWAInstall();

  const handleInstall = async () => {
    const outcome = await install();
    if (outcome === "unavailable") {
      // Fallback: scroll to manual instructions
      document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top nav ───────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-wide">SOLACE</span>
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

      {/* ── Hero ──────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at top, hsl(var(--primary) / 0.25) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground mb-6">
            <Zap className="h-3.5 w-3.5 text-primary" />
            40+ AI modules · One cinematic super-app
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Your <span className="text-primary">AI Guardian</span>.
            <br />
            Beautifully unified.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            SOLACE bundles your wellness, creativity, safety, and productivity tools into one
            cinematic experience — guided by an AI that talks, listens, and genuinely cares.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={handleInstall}
              disabled={isStandalone}
              className="shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
            >
              <Download className="mr-2 h-5 w-5" />
              {isStandalone ? "Already installed" : canInstall ? "Install SOLACE" : "How to install"}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/welcome")}>
              Try it in your browser <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-8 flex justify-center">
            <SecurityShield />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything in one place</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tap any tile in the live app to dive in. Here's a taste of what's inside.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="holo-tile rounded-xl p-5 text-left"
            >
              <Icon className="holo-icon h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Install ───────────────────────────── */}
      <section id="install" className="border-y border-border bg-card/40">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Install in seconds</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              SOLACE installs straight from your browser — no app store, no waiting. Works offline once installed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="rounded-xl border border-border bg-background p-6">
              <Smartphone className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Android</h3>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Open this site in <strong>Chrome</strong> or Edge.</li>
                <li>Tap <strong>Install SOLACE</strong> above.</li>
                <li>Confirm in the prompt — done.</li>
              </ol>
            </div>
            <div className="rounded-xl border border-border bg-background p-6">
              <Apple className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">iPhone / iPad</h3>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Open this site in <strong>Safari</strong>.</li>
                <li>Tap the <strong>Share</strong> icon.</li>
                <li>Choose <strong>Add to Home Screen</strong> → Add.</li>
              </ol>
            </div>
            <div className="rounded-xl border border-border bg-background p-6">
              <Monitor className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Desktop</h3>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Use <strong>Chrome, Edge, or Brave</strong>.</li>
                <li>Click the install icon in the address bar.</li>
                <li>Or hit the Install button above.</li>
              </ol>
            </div>
          </div>

          <div className="text-center">
            <Button size="lg" onClick={handleInstall} disabled={isStandalone}>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Free to start. Power when you need it.</h2>
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
              className={`rounded-xl border p-6 ${i === 1 ? "border-primary shadow-[0_0_30px_hsl(var(--primary)/0.2)]" : "border-border"}`}
            >
              <h3 className="font-semibold text-lg mb-1">{tier.name}</h3>
              <div className="text-3xl font-bold mb-4">{tier.price}</div>
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
      <section id="faq" className="border-t border-border bg-card/40">
        <div className="max-w-3xl mx-auto px-4 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">Common questions</h2>
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
                className="group rounded-xl border border-border bg-background p-5 open:shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
              >
                <summary className="cursor-pointer font-semibold flex items-center justify-between">
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
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
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
