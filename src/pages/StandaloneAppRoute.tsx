import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Star, Shield, Smartphone, Lock } from "lucide-react";
import SEO from "@/components/SEO";
import { getStandaloneApp } from "@/components/standalone/standaloneApps";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import NotFound from "./NotFound";

/**
 * Play Store-style display page for /apps/:slug.
 * This is a SHOWCASE ONLY — the real module never loads here. Visitors see
 * mock screenshots, description, rating, and an Install button. The only way
 * to actually use the app is to install ORACLE LUNAR and become a member.
 */
const StandaloneAppRoute = () => {
  const { slug = "" } = useParams();
  const app = getStandaloneApp(slug);
  const { canInstall, install, isIOS, isStandalone } = usePWAInstall();

  if (!app) return <NotFound />;
  const Icon = app.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={`${app.title} — ORACLE LUNAR`}
        description={app.description}
        path={`/apps/${app.slug}`}
      />

      <header className="border-b border-border sticky top-0 bg-background/90 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/apps" className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Back to all apps">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{app.title}</h1>
            <p className="text-[11px] text-muted-foreground truncate">ORACLE LUNAR</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* App header */}
        <section className="flex items-start gap-4">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-lg shrink-0`}>
            <Icon className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-tight">{app.title}</h2>
            <p className="text-sm text-muted-foreground">ORACLE LUNAR</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5 text-foreground">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 4.9
              </span>
              <span>·</span>
              <span>10K+ installs</span>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <Shield className="w-3 h-3" /> Members
              </span>
            </div>
          </div>
        </section>

        {/* Install CTA */}
        <section>
          {isStandalone ? (
            <Link
              to="/subscribe"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-primary-foreground font-semibold hover:opacity-90"
            >
              <Lock className="w-4 h-4" /> Become a member to open
            </Link>
          ) : canInstall ? (
            <button
              onClick={install}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground font-semibold hover:opacity-90"
            >
              <Download className="w-4 h-4" /> Install ORACLE LUNAR
            </button>
          ) : isIOS ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground text-center">
              <Smartphone className="w-4 h-4 mx-auto mb-1 text-primary" />
              On iPhone: tap <b>Share</b> → <b>Add to Home Screen</b>, then open ORACLE LUNAR and sign up.
            </div>
          ) : (
            <Link
              to="/"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground font-semibold hover:opacity-90"
            >
              <Download className="w-4 h-4" /> Get the app from the home page
            </Link>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            This is a preview only. To actually use {app.title} you need to install ORACLE LUNAR and become a member.
          </p>
        </section>

        {/* Mock screenshots */}
        <section>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Preview</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="snap-start shrink-0 w-44 aspect-[9/16] rounded-2xl border border-border bg-card overflow-hidden relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${app.color} opacity-30`} />
                <div className="relative h-full w-full flex flex-col items-center justify-center text-center p-4">
                  <Icon className="w-10 h-10 text-foreground mb-3" />
                  <p className="text-xs font-semibold text-foreground">{app.title}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-3">{app.tagline}</p>
                  <div className="absolute bottom-3 left-3 right-3 h-7 rounded-full bg-foreground/10 backdrop-blur flex items-center justify-center text-[10px] text-muted-foreground">
                    Locked preview
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">About this app</h3>
          <p className="text-sm leading-relaxed text-foreground">{app.description}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {app.title} is part of ORACLE LUNAR — a complete suite of 40+ AI tools for your life.
            Install the main app and become a member to unlock {app.title} and every other module.
          </p>
        </section>

        {/* What's in the full app */}
        <section className="rounded-2xl border border-primary/20 bg-card/60 p-5">
          <h3 className="text-sm font-semibold mb-2">What you get with membership</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Full access to {app.title} and 40+ other AI tools</li>
            <li>• Eric, your personal AI assistant, with memory</li>
            <li>• Voice + text everywhere, premium voices</li>
            <li>• Offline-friendly, installs to your home screen</li>
          </ul>
          <Link
            to="/subscribe"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-primary-foreground font-semibold hover:opacity-90"
          >
            See plans
          </Link>
        </section>

        <p className="text-center text-[11px] text-muted-foreground pb-8">
          ORACLE LUNAR · members-only · install required
        </p>
      </main>
    </div>
  );
};

export default StandaloneAppRoute;
