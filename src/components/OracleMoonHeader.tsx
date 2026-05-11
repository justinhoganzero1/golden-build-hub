import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface OracleMoonHeaderProps {
  children?: ReactNode;
}

/**
 * Oracle Moon Header — luxury cinematic header.
 * - Solar-eclipse moon with corona flare
 * - Triple orbit rings + orbiting jewels
 * - Constellations + slow nebula
 * - Engraved gold wordmark with sub-shimmer
 */
export default function OracleMoonHeader({ children }: OracleMoonHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden border-b border-amber-500/20">
      {/* Deep nebula backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 70% at 50% 100%, hsl(45 100% 50% / 0.20), transparent 70%),
            radial-gradient(ellipse 60% 40% at 18% 25%, hsl(280 80% 55% / 0.18), transparent 65%),
            radial-gradient(ellipse 55% 45% at 82% 30%, hsl(200 90% 55% / 0.14), transparent 60%),
            radial-gradient(ellipse 100% 60% at 50% 0%, hsl(0 0% 0% / 0.6), transparent 80%),
            linear-gradient(180deg, hsl(230 40% 4%) 0%, hsl(0 0% 3%) 100%)
          `,
        }}
      />

      {/* Constellation grid (CSS dots) */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20% 30%, white, transparent 50%),
            radial-gradient(1px 1px at 75% 18%, white, transparent 50%),
            radial-gradient(1.5px 1.5px at 40% 70%, hsl(45 100% 70%), transparent 60%),
            radial-gradient(1px 1px at 88% 80%, white, transparent 50%),
            radial-gradient(1px 1px at 12% 80%, hsl(200 100% 70%), transparent 60%),
            radial-gradient(1.5px 1.5px at 60% 40%, white, transparent 60%),
            radial-gradient(1px 1px at 35% 12%, white, transparent 50%),
            radial-gradient(1px 1px at 95% 50%, hsl(45 100% 70%), transparent 50%),
            radial-gradient(1px 1px at 6% 45%, white, transparent 50%)
          `,
          animation: "starDrift 18s linear infinite",
        }}
      />

      {/* Twinkling stars */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.2,
              animation: `starTwinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Main column */}
      <div className="relative z-10 px-4 py-10 sm:py-14 flex flex-col items-center text-center">
        {/* ── Eclipse moon ── */}
        <div className="relative mb-5" style={{ width: 132, height: 132 }}>
          {/* Outer corona flare */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, hsl(45 100% 65% / 0.55) 0%, hsl(40 100% 50% / 0.25) 30%, transparent 65%)",
              filter: "blur(28px)",
              transform: "scale(2.4)",
              animation: "coronaPulse 5s ease-in-out infinite",
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, hsl(48 100% 72% / 0.65) 0%, transparent 55%)",
              filter: "blur(14px)",
              transform: "scale(1.55)",
              animation: "coronaPulse 5s ease-in-out infinite 1s",
            }}
          />

          {/* Orbit rings */}
          <div
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: "hsl(45 100% 50% / 0.35)",
              transform: "scale(2.6)",
              animation: "orbitSpin 28s linear infinite",
              borderStyle: "dashed",
            }}
          />
          <div
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: "hsl(200 100% 60% / 0.22)",
              transform: "scale(2.0)",
              animation: "orbitSpin 18s linear infinite reverse",
              borderStyle: "dotted",
            }}
          />
          <div
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: "hsl(330 100% 65% / 0.18)",
              transform: "scale(1.55)",
              animation: "orbitSpin 12s linear infinite",
            }}
          />

          {/* Orbiting jewels */}
          <span
            className="absolute rounded-full"
            style={{
              width: 8, height: 8, top: "50%", left: "50%",
              background: "radial-gradient(circle at 30% 30%, hsl(45 100% 80%), hsl(40 100% 45%))",
              boxShadow: "0 0 12px hsl(45 100% 60%), 0 0 24px hsl(45 100% 50% / 0.6)",
              animation: "orbitJewel1 9s linear infinite",
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 6, height: 6, top: "50%", left: "50%",
              background: "radial-gradient(circle at 30% 30%, hsl(200 100% 80%), hsl(210 100% 45%))",
              boxShadow: "0 0 10px hsl(200 100% 65%)",
              animation: "orbitJewel2 14s linear infinite",
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 5, height: 5, top: "50%", left: "50%",
              background: "radial-gradient(circle at 30% 30%, hsl(330 100% 80%), hsl(320 100% 50%))",
              boxShadow: "0 0 10px hsl(330 100% 65%)",
              animation: "orbitJewel3 11s linear infinite",
            }}
          />

          {/* Eclipse moon SVG */}
          <svg viewBox="0 0 132 132" className="relative z-10 w-full h-full">
            <defs>
              <radialGradient id="eclipseRim" cx="50%" cy="50%" r="50%">
                <stop offset="78%"  stopColor="hsl(45 100% 55%)" stopOpacity="0" />
                <stop offset="92%"  stopColor="hsl(48 100% 70%)" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(40 100% 45%)" stopOpacity="0.6" />
              </radialGradient>
              <radialGradient id="moonBody" cx="40%" cy="40%" r="60%">
                <stop offset="0%"  stopColor="hsl(230 30% 14%)" />
                <stop offset="70%" stopColor="hsl(230 35% 8%)" />
                <stop offset="100%" stopColor="hsl(230 40% 4%)" />
              </radialGradient>
              <linearGradient id="hairlineGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="hsl(48 100% 75%)" />
                <stop offset="50%"  stopColor="hsl(45 100% 55%)" />
                <stop offset="100%" stopColor="hsl(40 100% 35%)" />
              </linearGradient>
            </defs>

            {/* Corona ring (gold halo) */}
            <circle cx="66" cy="66" r="62" fill="url(#eclipseRim)" />

            {/* Eclipsed dark moon disc */}
            <circle cx="66" cy="66" r="50" fill="url(#moonBody)" />

            {/* Hairline gold rim */}
            <circle cx="66" cy="66" r="50" fill="none" stroke="url(#hairlineGold)" strokeWidth="0.8" opacity="0.9" />

            {/* Subtle craters */}
            <circle cx="52" cy="52" r="4" fill="hsl(230 30% 18% / 0.6)" />
            <circle cx="78" cy="62" r="3" fill="hsl(230 30% 18% / 0.5)" />
            <circle cx="60" cy="80" r="3.5" fill="hsl(230 30% 18% / 0.45)" />
            <circle cx="84" cy="84" r="2" fill="hsl(230 30% 18% / 0.4)" />

            {/* Bright corona "diamond ring" point */}
            <circle cx="116" cy="50" r="3.5" fill="hsl(48 100% 85%)">
              <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="116" cy="50" r="7" fill="hsl(48 100% 70% / 0.4)">
              <animate attributeName="r" values="6;9;6" dur="3s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        {/* ── Engraved wordmark ── */}
        <button
          onClick={() => navigate("/")}
          className="group flex flex-col items-center"
          aria-label="Oracle Lunar home"
        >
          <h1
            className="text-3xl sm:text-5xl font-black tracking-[0.22em] leading-none"
            style={{
              fontFamily: "'Cinzel','Trajan Pro',Georgia,serif",
              backgroundImage:
                "linear-gradient(180deg, hsl(48 100% 82%) 0%, hsl(45 100% 60%) 45%, hsl(38 100% 38%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.6)) drop-shadow(0 0 18px hsl(45 100% 50% / 0.45))",
              letterSpacing: "0.22em",
            }}
          >
            ORACLE&nbsp;LUNAR
          </h1>
          {/* Decorative gold flourish */}
          <div className="mt-2 flex items-center gap-2 opacity-80">
            <span className="block h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
            <span className="text-amber-300 text-xs">✦</span>
            <span className="block h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
          </div>
          <p className="mt-2 text-[11px] sm:text-xs uppercase tracking-[0.35em] text-amber-200/80">
            Your AI best friend
          </p>
        </button>

        {children && <div className="mt-5 w-full">{children}</div>}
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
      />

      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%      { opacity: 1;   transform: scale(1.3); }
        }
        @keyframes starDrift {
          0%   { background-position: 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0; }
          100% { background-position: 60px 30px, -40px 50px, 80px -20px, -30px 40px, 50px 60px, -60px -30px, 40px 20px, -50px 10px, 30px -40px; }
        }
        @keyframes coronaPulse {
          0%, 100% { opacity: 0.55; transform: scale(2.2); }
          50%      { opacity: 1;    transform: scale(2.7); }
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg)   scale(var(--s, 1)); }
          to   { transform: rotate(360deg) scale(var(--s, 1)); }
        }
        @keyframes orbitJewel1 {
          0%   { transform: translate(-50%, -50%) rotate(0deg)   translateX(72px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(72px) rotate(-360deg); }
        }
        @keyframes orbitJewel2 {
          0%   { transform: translate(-50%, -50%) rotate(0deg)   translateX(56px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(56px) rotate(-360deg); }
        }
        @keyframes orbitJewel3 {
          0%   { transform: translate(-50%, -50%) rotate(0deg)   translateX(44px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(-360deg) translateX(44px) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
