import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, ExternalLink, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import FloatingOracleHelper from "./FloatingOracleHelper";
import { usePWAInstall } from "@/hooks/usePWAInstall";

/**
 * Shell used by every standalone /apps/<slug> route.
 * Provides a focused, single-screen chrome with:
 *   - SEO tags
 *   - Header (back, title, install + open-full-app CTAs)
 *   - Floating Oracle helper for in-app guidance
 */
interface Props {
  slug: string;
  title: string;
  tagline: string;
  fullAppPath: string; // route to the full in-app version
  children: ReactNode;
}

export const StandaloneAppShell = ({ slug, title, tagline, fullAppPath, children }: Props) => {
  const { canInstall, install, isIOS, isStandalone } = usePWAInstall();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title={`${title} — Standalone SOLACE App`}
        description={tagline}
        path={`/apps/${slug}`}
      />
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/apps" className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Back to all apps">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{title}</h1>
            <p className="text-xs text-muted-foreground truncate">{tagline}</p>
          </div>
          {!isStandalone && canInstall && (
            <button
              onClick={install}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
            >
              <Download className="w-3.5 h-3.5" /> Install
            </button>
          )}
          {!isStandalone && isIOS && (
            <span className="hidden sm:inline text-[10px] text-muted-foreground">Share → Add to Home Screen</span>
          )}
          <Link
            to={fullAppPath}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-muted"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Full app
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">SOLACE</Link>
        <span className="mx-2">·</span>
        <Link to="/apps" className="hover:text-foreground">All apps</Link>
        <span className="mx-2">·</span>
        <Link to="/privacy-policy" className="hover:text-foreground">Privacy</Link>
      </footer>

      <FloatingOracleHelper appName={title} />
    </div>
  );
};

export default StandaloneAppShell;
