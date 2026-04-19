import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, Lock, Smartphone } from "lucide-react";
import { isDemoMode } from "@/lib/demoMode";
import { usePWAInstall } from "@/hooks/usePWAInstall";

/**
 * DemoGate
 * In the browser preview, the entire app is a "plastic display screen".
 * Wrapping any feature in <DemoGate> replaces it with a download wall.
 * Once installed (PWA standalone) OR ?live=1 override, children render normally.
 *
 * Use ONLY for feature pages — not for the public landing page or sign-in.
 */
const DemoGate = ({ children, featureName }: { children: ReactNode; featureName?: string }) => {
  const demo = isDemoMode();
  const { canInstall, install, isIOS } = usePWAInstall();

  if (!demo) return <>{children}</>;

  const onInstall = async () => {
    if (canInstall) await install();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full text-center space-y-6 rounded-3xl border border-primary/30 bg-card/80 backdrop-blur p-8 shadow-2xl shadow-primary/10">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {featureName ? `${featureName} is locked` : "This is a demo preview"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The website is a showcase only — like a display screen in a shop window.
            To actually use ORACLE LUNAR you need to install the app and sign up inside it.
          </p>
        </div>

        <div className="space-y-2">
          {canInstall ? (
            <button
              onClick={onInstall}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground font-semibold hover:opacity-90"
            >
              <Download className="w-4 h-4" /> Install the ORACLE LUNAR app
            </button>
          ) : isIOS ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <Smartphone className="w-4 h-4 mx-auto mb-1 text-primary" />
              On iPhone: tap <b>Share</b> → <b>Add to Home Screen</b>, then open ORACLE LUNAR from your home screen and sign up.
            </div>
          ) : (
            <Link
              to="/"
              className="block w-full rounded-full bg-primary px-5 py-3 text-primary-foreground font-semibold hover:opacity-90"
            >
              Go to home — install from there
            </Link>
          )}
          <Link
            to="/"
            className="block text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to landing
          </Link>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Once installed, sign up inside the app to unlock the real Oracle and every feature.
        </p>
      </div>
    </div>
  );
};

export default DemoGate;
