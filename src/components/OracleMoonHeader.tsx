import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface OracleMoonHeaderProps {
  children?: ReactNode;
}

/**
 * Oracle Lunar Header — 4K cinematic AI hero.
 * Full-bleed AI-generated cosmic video background with engraved gold
 * wordmark, gold flourish, and capability marquee. Designed to look
 * premium on Play Store / App Store hero shots.
 */
export default function OracleMoonHeader({ children }: OracleMoonHeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Each marquee chip links to the actual feature. Guests are routed to
  // /sign-in?redirect=<route> so they land inside that exact app right after
  // signing up / logging in. Signed-in users navigate straight there.
  const capabilities: { label: string; route: string }[] = [
    { label: "Cinematic AI Portraits", route: "/photography-hub" },
    { label: "4K Avatars",             route: "/avatar-generator" },
    { label: "Story Writer",           route: "/story-writer" },
    { label: "Movie Studio",           route: "/movie-studio-pro" },
    { label: "Magic Photo Edit",       route: "/teleport" },
    { label: "Voice Cloning",          route: "/voice-studio" },
    { label: "Live Vision",            route: "/live-vision" },
    { label: "Brand & Logo Lab",       route: "/photography-hub" },
    { label: "AI Tutor",               route: "/ai-tutor" },
    { label: "App Builder",            route: "/app-builder" },
  ];

  const goToApp = (route: string) => {
    if (user) {
      navigate(route);
    } else {
      navigate(`/sign-in?redirect=${encodeURIComponent(route)}`);
    }
  };


  return (
    <div className="relative overflow-hidden border-b border-border/70">
      {/* ── Oracle's glass office shows through; soft gold and teal light strips sweep across. ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 45% at 50% 38%, hsl(var(--primary) / 0.14), transparent 70%),
            linear-gradient(180deg, hsl(var(--background) / 0.25) 0%, transparent 35%, transparent 65%, hsl(var(--background) / 0.55) 100%)
          `,
        }}
      />
      <div
        className="absolute pointer-events-none oracle-header-sweep"
        style={{
          inset: "-20% -60%",
          background: "linear-gradient(110deg, transparent 42%, hsl(var(--oracle-teal) / 0.08) 48%, hsl(var(--primary) / 0.10) 52%, transparent 58%)",
          animation: "oracleHeaderSweep 9s ease-in-out infinite",
        }}
      />

      {/* ── Foreground content ── */}
      <div className="relative z-10 px-4 py-12 sm:py-20 flex flex-col items-center text-center min-h-[360px] sm:min-h-[460px]">
        {/* Crown badge */}
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em] bg-card/60 backdrop-blur border border-primary/40 text-primary">
          <span>✦</span>
          <span>4K Cinematic AI</span>
          <span>✦</span>
        </div>

        {/* Engraved wordmark */}
        <button
          onClick={() => navigate("/")}
          className="group flex flex-col items-center"
          aria-label="Oracle Lunar home"
        >
          <div
            role="text"
            aria-label="Oracle Lunar"
            className="font-black leading-none whitespace-nowrap"
            style={{
              fontFamily: "'Cinzel','Trajan Pro',Georgia,serif",
              // Scales with the screen so the wordmark never spills off the sides
              fontSize: "clamp(1.5rem, 8.5vw, 4.5rem)",
              letterSpacing: "clamp(0.08em, 1.2vw, 0.22em)",
              backgroundImage:
                "linear-gradient(180deg, hsl(48 100% 88%) 0%, hsl(45 100% 62%) 45%, hsl(38 100% 38%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter:
                "drop-shadow(0 2px 0 rgba(0,0,0,0.7)) drop-shadow(0 0 24px hsl(45 100% 50% / 0.6)) drop-shadow(0 0 60px hsl(45 100% 45% / 0.35))",
            }}
          >
            ORACLE&nbsp;LUNAR
          </div>

          {/* Gold flourish */}
          <div className="mt-3 flex items-center gap-3 opacity-90">
            <span className="block h-px w-16 sm:w-28 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <span className="text-primary text-sm">✦</span>
            <span className="block h-px w-16 sm:w-28 bg-gradient-to-r from-transparent via-primary to-transparent" />
          </div>

          <p className="mt-3 text-[11px] sm:text-sm uppercase tracking-[0.4em] text-primary/90 drop-shadow">
            Welcome to
          </p>
          <p className="mt-1 text-xs sm:text-base text-foreground/85 max-w-md drop-shadow">
            The world's first cinematic AI super-app.
          </p>
        </button>

        {/* Capability marquee */}
        <div className="relative w-full mt-6 overflow-hidden mask-fade">
          <div
            className="flex gap-3 whitespace-nowrap"
            style={{ animation: "marqueeSlide 28s linear infinite" }}
          >
            {[...capabilities, ...capabilities].map((cap, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToApp(cap.route)}
                data-auth-allow
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-card/60 backdrop-blur-sm border border-border text-foreground hover:bg-primary/15 hover:border-primary/60 transition cursor-pointer"
                aria-label={user ? `Open ${cap.label}` : `Sign in to open ${cap.label}`}
              >
                <span className="text-primary">✦</span>
                {cap.label}
              </button>
            ))}
          </div>
        </div>

        {children && <div className="mt-5 w-full">{children}</div>}
      </div>

      <style>{`
        @keyframes oracleHeaderSweep {
          0%, 100% { transform: translateX(-30%); }
          50%      { transform: translateX(30%); }
        }
        @media (prefers-reduced-motion: reduce) { .oracle-header-sweep { animation: none !important; } }
        @keyframes marqueeSlide {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .mask-fade {
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
        }
      `}</style>
    </div>
  );
}
