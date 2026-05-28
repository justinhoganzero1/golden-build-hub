import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePreviewMode } from "@/hooks/usePreviewMode";

/**
 * 🌟 Global Preview Watermark — HARD TEASE
 *
 * Unauthenticated visitors see a bold, screen-covering "PREVIEW" tile pattern
 * pulsing in amber. The entire tile layer is a clickable link → /sign-up
 * (with a secondary Sign-in option). Authenticated users see nothing.
 *
 * The pattern is deliberately heavy so previews feel like an empty shell —
 * teasing the real, fully-illustrated experience that unlocks on sign-up.
 */
const PreviewWatermark = () => {
  const { user, loading } = useAuth();
  const isPreview = usePreviewMode();
  const navigate = useNavigate();

  if (loading) return null;
  if (user) return null;

  const goSignUp = () => navigate("/sign-up");
  const goSignIn = () => navigate("/sign-in");

  return (
    <>
      {/* Full-screen clickable watermark tease */}
      <button
        type="button"
        onClick={goSignUp}
        aria-label="Preview mode — click to sign up and unlock the real app"
        className="fixed inset-0 z-[60] cursor-pointer select-none overflow-hidden block w-full h-full text-left"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -30deg,
            transparent 0,
            transparent 90px,
            hsl(45 100% 50% / 0.10) 90px,
            hsl(45 100% 50% / 0.10) 94px
          )`,
        }}
      >
        {/* dim veil so the underlying UI feels "shell-like" */}
        <div className="absolute inset-0 bg-background/35 backdrop-blur-[1px]" />

        {/* big tiled diagonal label */}
        <div
          className="absolute inset-0 flex flex-wrap items-center justify-center gap-x-10 gap-y-8 -rotate-[24deg] scale-150"
          style={{ opacity: 0.35 }}
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <span
              key={i}
              className="text-[22px] sm:text-[30px] md:text-[38px] font-black tracking-[0.3em] uppercase whitespace-nowrap"
              style={{
                color: "hsl(45 100% 60%)",
                textShadow:
                  "0 0 12px hsl(45 100% 50% / 0.7), 0 0 2px hsl(0 0% 0% / 0.9)",
                WebkitTextStroke: "0.5px hsl(0 0% 0% / 0.5)",
              }}
            >
              Preview · Sign up to unlock
            </span>
          ))}
        </div>
      </button>

      {/* Foreground CTA pill — sits on top of the watermark, fully interactive */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] px-3 w-full max-w-lg pointer-events-none">
        <div className="pointer-events-auto rounded-2xl border-2 border-amber-500/70 bg-background/95 backdrop-blur-md shadow-[0_10px_40px_hsl(45_100%_50%/0.45)] p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 px-1 flex-1 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-xs sm:text-sm leading-tight">
              <div className="font-bold text-amber-400">Preview mode — shell only</div>
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
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-background hover:from-amber-400 hover:to-amber-500 transition-colors shadow-md"
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
