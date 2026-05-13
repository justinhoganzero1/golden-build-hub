import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import heroBackground from "@/assets/oracle-lunar-hero-gold.jpg";

interface OracleMoonHeaderProps {
  children?: ReactNode;
}

/**
 * Oracle Lunar Header — 8K cinematic AI hero.
 * Full-bleed AI-generated cosmic video background with engraved gold
 * wordmark, gold flourish, and capability marquee. Designed to look
 * premium on Play Store / App Store hero shots.
 */
export default function OracleMoonHeader({ children }: OracleMoonHeaderProps) {
  const navigate = useNavigate();

  const capabilities = [
    "Cinematic AI Portraits",
    "8K Avatars",
    "Story Writer",
    "Movie Studio",
    "Magic Photo Edit",
    "Voice Cloning",
    "Live Vision",
    "Brand & Logo Lab",
    "AI Tutor",
    "App Builder",
  ];

  return (
    <div className="relative overflow-hidden border-b border-amber-500/30">
      {/* ── Cinematic gold-particle background ── */}
      <img
        src={heroBackground}
        alt=""
        aria-hidden="true"
        width={1920}
        height={1080}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "saturate(1.1) contrast(1.05) brightness(0.95)" }}
      />

      {/* Cinematic vignette + gold glow overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 50%, transparent 0%, hsl(0 0% 0% / 0.55) 90%),
            linear-gradient(180deg, hsl(0 0% 0% / 0.35) 0%, transparent 30%, transparent 60%, hsl(var(--background)) 100%),
            radial-gradient(ellipse 60% 40% at 50% 30%, hsl(45 100% 50% / 0.18), transparent 70%)
          `,
        }}
      />

      {/* Subtle film-grain shimmer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
        style={{
          background:
            "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%)",
          backgroundSize: "300% 300%",
          animation: "heroSheen 8s ease-in-out infinite",
        }}
      />

      {/* ── Foreground content ── */}
      <div className="relative z-10 px-4 py-12 sm:py-20 flex flex-col items-center text-center min-h-[360px] sm:min-h-[460px]">
        {/* Crown badge */}
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em] bg-black/40 backdrop-blur border border-amber-400/40 text-amber-200">
          <span>✦</span>
          <span>8K Cinematic AI</span>
          <span>✦</span>
        </div>

        {/* Engraved wordmark */}
        <button
          onClick={() => navigate("/")}
          className="group flex flex-col items-center"
          aria-label="Oracle Lunar home"
        >
          <h1
            className="text-4xl sm:text-7xl font-black tracking-[0.22em] leading-none"
            style={{
              fontFamily: "'Cinzel','Trajan Pro',Georgia,serif",
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
          </h1>

          {/* Gold flourish */}
          <div className="mt-3 flex items-center gap-3 opacity-90">
            <span className="block h-px w-16 sm:w-28 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            <span className="text-amber-200 text-sm">✦</span>
            <span className="block h-px w-16 sm:w-28 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
          </div>

          <p className="mt-3 text-[11px] sm:text-sm uppercase tracking-[0.4em] text-amber-100/90 drop-shadow">
            Your AI best friend
          </p>
          <p className="mt-1 text-xs sm:text-base text-white/80 max-w-md drop-shadow">
            One app. Infinite creativity. Cinematic AI for everyone.
          </p>
        </button>

        {/* Capability marquee */}
        <div className="relative w-full mt-6 overflow-hidden mask-fade">
          <div
            className="flex gap-3 whitespace-nowrap"
            style={{ animation: "marqueeSlide 28s linear infinite" }}
          >
            {[...capabilities, ...capabilities].map((cap, i) => (
              <span
                key={i}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-black/45 backdrop-blur-sm border border-amber-400/30 text-amber-100"
              >
                <span className="text-amber-300">✦</span>
                {cap}
              </span>
            ))}
          </div>
        </div>

        {children && <div className="mt-5 w-full">{children}</div>}
      </div>

      <style>{`
        @keyframes heroSheen {
          0%   { background-position: 200% 0; }
          100% { background-position: -100% 0; }
        }
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
