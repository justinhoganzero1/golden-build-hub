import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Crown, X, ExternalLink, Unlock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

interface FeaturePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  desc: string;
  icon: LucideIcon;
  to: string;
}

const FeaturePreviewDialog = ({ open, onOpenChange, title, desc, icon: Icon, to }: FeaturePreviewDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscribed } = useSubscription();
  const isAdmin = user?.email === "justinbretthogan@gmail.com";
  // Fully interactive only when logged in AND a paying member (or admin)
  const isInteractive = !!user && (subscribed || isAdmin);
  const previewRoute = !isInteractive && to === "/oracle" ? "/oracle-preview" : to;
  const previewUrl = isInteractive
    ? to
    : `${previewRoute}${previewRoute.includes("?") ? "&" : "?"}preview=1`;

  // Carry the feature path through sign-up / upgrade so the user lands directly
  // on the feature afterwards. Any per-feature paywall (Subscribe / app-unlock)
  // will then prompt naturally on arrival.
  const encodedTo = encodeURIComponent(to);
  const goUnlock = () => {
    onOpenChange(false);
    if (!user) {
      navigate(`/welcome?redirect=${encodedTo}`);
    } else {
      // Logged-in but not subscribed — send to subscribe with a return path
      navigate(`/subscribe?redirect=${encodedTo}`);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-background border-primary/30 overflow-hidden">
        {/* Banner — flips between demo-only and interactive */}
        {isInteractive ? (
          <div
            className="shrink-0 border-b border-primary/60 bg-primary/15 px-4 py-2 text-center text-primary text-xs font-bold tracking-wide flex items-center justify-center gap-2"
            role="status"
          >
            <Unlock className="w-4 h-4" />
            FULLY INTERACTIVE — Welcome back, member. Everything you do here is live and saved.
          </div>
        ) : (
          <div
            className="shrink-0 border-b border-destructive/60 bg-destructive/15 px-4 py-2 text-center text-destructive text-xs font-bold tracking-wide animate-pulse flex items-center justify-center gap-2"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4" />
            DISPLAY ONLY — Live preview of {title}. Sign in &amp; become a member to use it for real.
          </div>
        )}

        {/* Header strip */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-card/60">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {title} <span className="text-xs font-normal text-muted-foreground">· {isInteractive ? "Live" : "Preview"}</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isInteractive && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate(user ? "/subscribe" : "/welcome");
                }}
                className="hidden sm:inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity"
              >
                <Crown className="w-3.5 h-3.5" />
                {user ? "Upgrade to unlock" : "Sign in to unlock"}
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live page preview — read-only when not a member, fully interactive when subscribed */}
        <div className="flex-1 relative bg-background overflow-hidden">
          <iframe
            src={previewUrl}
            title={`${title} preview`}
            className="absolute inset-0 w-full h-full border-0"
            sandbox={
              isInteractive
                ? "allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-presentation allow-storage-access-by-user-activation"
                : "allow-scripts allow-same-origin"
            }
          />
          {!isInteractive && (
            <div
              className="absolute inset-0 bg-transparent"
              style={{ pointerEvents: "auto" }}
              aria-hidden="true"
              onClickCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenChange(false);
                navigate(user ? "/subscribe" : "/welcome");
              }}
            />
          )}
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-border bg-card/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            {isInteractive ? (
              <>You have full access to <strong className="text-foreground">{title}</strong>. Enjoy — your changes are saved.</>
            ) : (
              <>This is exactly what the live <strong className="text-foreground">{title}</strong> looks like — interaction unlocks after sign-in &amp; membership.</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(to);
              }}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open real page
            </Button>
            {!isInteractive && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate(user ? "/subscribe" : "/welcome");
                }}
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
              >
                <Crown className="w-4 h-4" />
                {user ? `Upgrade to unlock ${title}` : "Sign in & become a member"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeaturePreviewDialog;
