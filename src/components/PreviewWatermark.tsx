import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePreviewMode } from "@/hooks/usePreviewMode";

/**
 * 🌟 Global Preview Watermark
 *
 * Shows on every page when the visitor is NOT signed in.
 * Two layers:
 *   1. A tiled diagonal "PREVIEW • SIGN IN TO USE" pattern at ~12% opacity
 *      — noticeable but not blocking the UI.
 *   2. A bottom-center pill with Sign In / Sign Up buttons.
 *
 * Authenticated users see nothing.
 * Pointer-events stay off the tile layer so the user can still
 * scroll, click and explore — they just can't pretend it's theirs.
 */
const PreviewWatermark = () => {
  const { user, loading } = useAuth();
  const isPreview = usePreviewMode();
  const navigate = useNavigate();

  // Don't render until auth state settles — avoids a flash for signed-in users.
  if (loading) return null;
  if (user) return null;

  return (
    <>
      {/* Tiled diagonal watermark — covers the whole viewport, behind interaction */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] select-none overflow-hidden"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -30deg,
            transparent 0,
            transparent 140px,
            hsl(45 100% 50% / 0.06) 140px,
            hsl(45 100% 50% / 0.06) 142px
          )`,
        }}
      >
        <div
          className="absolute inset-0 flex flex-wrap items-center justify-center gap-x-16 gap-y-10 -rotate-[24deg] scale-125"
          style={{ opacity: 0.13 }}
        >
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="text-[18px] sm:text-[22px] font-bold tracking-[0.25em] uppercase whitespace-nowrap"
              style={{
                color: "hsl(45 100% 65%)",
                textShadow: "0 0 8px hsl(45 100% 50% / 0.5)",
              }}
            >
              Preview · Sign in to use
            </span>
          ))}
        </div>
      </div>

      {/* Bottom CTA pill — interactive, prompts sign-up / sign-in */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] px-3 w-full max-w-md">
        <div className="rounded-full border border-amber-500/50 bg-background/85 backdrop-blur-md shadow-[0_8px_30px_hsl(45_100%_50%/0.25)] flex items-center gap-2 p-1.5">
          <div className="flex-1 min-w-0 px-3 text-[11px] sm:text-xs text-foreground/90 leading-tight">
            <span className="text-amber-500 font-semibold">Preview mode</span>
            <span className="hidden sm:inline"> — sign in to actually use this feature.</span>
            <span className="sm:hidden"> — sign in to use.</span>
          </div>
          <button
            onClick={() => navigate("/sign-in")}
            className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            aria-label="Sign in"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign in</span>
          </button>
          <button
            onClick={() => navigate("/sign-up")}
            className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-background hover:from-amber-400 hover:to-amber-500 transition-colors"
            aria-label="Sign up"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign up</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default PreviewWatermark;
