import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePreviewMode } from "@/hooks/usePreviewMode";

/**
 * Global preview CTA.
 * Keep public pages readable: never place a full-screen watermark over content.
 */
const PreviewWatermark = () => {
  const { user, loading } = useAuth();
  const isPreview = usePreviewMode();
  const navigate = useNavigate();
  const isAuthPage = typeof window !== "undefined" && window.location.pathname.startsWith("/sign-in");

  if (loading) return null;
  if (user) return null;
  if (isAuthPage) return null;

  const goSignUp = () => navigate("/sign-in?fresh=1&mode=signup&redirect=/dashboard");
  const goSignIn = () => navigate("/sign-in?fresh=1&redirect=/dashboard");

  return (
    <>
      {/* Foreground CTA pill — visible without blocking or dimming the app */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] px-3 w-full max-w-lg pointer-events-none">
        <div className="pointer-events-auto rounded-xl border-2 border-primary/80 bg-background/95 backdrop-blur-md shadow-[0_10px_40px_hsl(var(--primary)/0.45)] p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 px-1 flex-1 min-w-0">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div className="text-xs sm:text-sm leading-tight">
              <div className="font-bold text-primary">Preview mode</div>
              <div className="text-foreground/80">Sign up to unlock the real Oracle Lunar.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={goSignIn}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border border-border text-foreground hover:bg-secondary transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in</span>
            </button>
            <button
              onClick={goSignUp}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign up free</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PreviewWatermark;
