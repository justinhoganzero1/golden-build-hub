import { Link } from "react-router-dom";
import { Download, ArrowLeft, Star, Shield } from "lucide-react";
import SEO from "@/components/SEO";
import { STANDALONE_APPS } from "@/components/standalone/standaloneApps";
import { usePWAInstall } from "@/hooks/usePWAInstall";

/**
 * Play Store-style storefront listing all ORACLE LUNAR modules.
 * Each card links to /apps/<slug>, which is a display-only detail page.
 * Nothing actually runs here — install + membership required to use the apps.
 */
const AppsStorefrontPage = () => {
  const { canInstall, install, isIOS, isStandalone } = usePWAInstall();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="ORACLE LUNAR Apps — 40+ AI tools, members only"
        description="Browse every ORACLE LUNAR app — Oracle chat, AI tutor, mind hub, crisis help, photo magic, marketing, companion, wallet, calendar, live vision and more. Install the app and become a member to unlock them."
        path="/apps"
      />

      <header className="border-b border-border sticky top-0 bg-background/90 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Home">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg">ORACLE LUNAR Apps</h1>
            <p className="text-xs text-muted-foreground">Tap any app to see what it does</p>
          </div>
          {!isStandalone && canInstall && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Install
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <section className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Every ORACLE LUNAR tool — <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">members only</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
            Browse the catalog. To actually use any app, install ORACLE LUNAR and become a member.
          </p>
          {!isStandalone && isIOS && (
            <p className="mt-2 text-xs text-muted-foreground">On iPhone? Tap Share → Add to Home Screen to install.</p>
          )}
        </section>

        <div className="space-y-2">
          {STANDALONE_APPS.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.slug}
                to={`/apps/${app.slug}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-md shrink-0`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{app.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{app.tagline}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5 text-foreground">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 4.9
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Shield className="w-3 h-3" /> Members
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-primary px-3 py-1.5 rounded-full bg-primary/10">
                  View
                </span>
              </Link>
            );
          })}
        </div>

        <section className="mt-10 text-center text-sm text-muted-foreground">
          Ready to unlock everything?{" "}
          <Link to="/subscribe" className="text-primary font-medium hover:underline">Become a member</Link>
        </section>
      </main>
    </div>
  );
};

export default AppsStorefrontPage;
