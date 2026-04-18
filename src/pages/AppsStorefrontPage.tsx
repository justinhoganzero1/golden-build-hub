import { Link } from "react-router-dom";
import { Download, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { STANDALONE_APPS } from "@/components/standalone/standaloneApps";
import { usePWAInstall } from "@/hooks/usePWAInstall";

/**
 * Public storefront listing all standalone SOLACE apps.
 * Each card links to /apps/<slug>. Free to use, with floating
 * Oracle helper inside each app and an option to install the
 * full SOLACE PWA.
 */
const AppsStorefrontPage = () => {
  const { canInstall, install, isIOS, isStandalone } = usePWAInstall();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="SOLACE Apps — Free standalone AI tools"
        description="Download or use any SOLACE AI app standalone — Oracle chat, AI tutor, mind hub, crisis help, photo magic, marketing, companion, wallet, calendar, and live vision. Each comes with Eric, your built-in AI helper."
        path="/apps"
      />
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Home">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg">SOLACE Apps</h1>
            <p className="text-xs text-muted-foreground">Pick any tool — use it free, install if you love it</p>
          </div>
          {!isStandalone && canInstall && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Install full app
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Every SOLACE tool, <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">on its own</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Each one is a focused, single-purpose app with Eric — your built-in AI helper — ready to guide you.
          </p>
          {!isStandalone && isIOS && (
            <p className="mt-2 text-xs text-muted-foreground">On iPhone? Tap Share → Add to Home Screen to install.</p>
          )}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STANDALONE_APPS.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.slug}
                to={`/apps/${app.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-all hover:-translate-y-0.5"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center mb-3 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold">{app.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{app.tagline}</p>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{app.description}</p>
                <div className="mt-4 text-xs font-medium text-primary group-hover:underline">Open →</div>
              </Link>
            );
          })}
        </div>

        <section className="mt-12 text-center text-sm text-muted-foreground">
          Want everything in one place?{" "}
          <Link to="/" className="text-primary font-medium hover:underline">Get the full SOLACE app</Link>
        </section>
      </main>
    </div>
  );
};

export default AppsStorefrontPage;
