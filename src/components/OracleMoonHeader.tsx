import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import oracleLunarLogo from "@/assets/oracle-lunar-logo.png";

interface OracleMoonHeaderProps {
  children?: ReactNode;
}

/**
 * Oracle Moon Header — cinematic cosmic header for the dashboard.
 * Features a glowing crescent moon, orbiting particle ring, and nebula backdrop.
 */
export default function OracleMoonHeader({ children }: OracleMoonHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden">
      {/* Deep space nebula backdrop */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 100%, hsl(45 100% 50% / 0.18), transparent 70%),
            radial-gradient(ellipse 60% 40% at 20% 20%, hsl(280 80% 60% / 0.12), transparent 60%),
            radial-gradient(ellipse 50% 50% at 80% 30%, hsl(200 90% 55% / 0.10), transparent 55%),
            radial-gradient(circle at 50% 50%, hsl(45 100% 30% / 0.08), transparent 70%)
          `,
        }}
      />

      {/* Animated stars */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(24)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.7 + 0.2,
              animation: `star-twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 px-4 py-8 sm:py-10 flex flex-col items-center text-center">
        {/* Oracle Moon */}
        <div className="relative mb-4">
          {/* Outer glow rings */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(45 100% 50% / 0.35) 0%, transparent 70%)",
              filter: "blur(20px)",
              transform: "scale(1.8)",
              animation: "moon-pulse-glow 4s ease-in-out infinite",
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(45 100% 65% / 0.20) 0%, transparent 60%)",
              filter: "blur(12px)",
              transform: "scale(1.4)",
              animation: "moon-pulse-glow 4s ease-in-out infinite 0.5s",
            }}
          />

          {/* Orbit ring */}
          <div
            className="absolute inset-0 rounded-full border border-dashed"
            style={{
              borderColor: "hsl(45 100% 50% / 0.25)",
              transform: "scale(2.2)",
              animation: "orbit-spin 20s linear infinite",
            }}
          />
          <div
            className="absolute inset-0 rounded-full border border-dotted"
            style={{
              borderColor: "hsl(200 100% 60% / 0.18)",
              transform: "scale(1.7)",
              animation: "orbit-spin 15s linear infinite reverse",
            }}
          />

          {/* Orbiting dots */}
          <div
            className="absolute rounded-full"
            style={{
              width: "6px",
              height: "6px",
              background: "hsl(45 100% 60%)",
              boxShadow: "0 0 8px hsl(45 100% 60%)",
              top: "50%",
              left: "50%",
              animation: "orbit-dot-1 8s linear infinite",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: "4px",
              height: "4px",
              background: "hsl(200 100% 65%)",
              boxShadow: "0 0 6px hsl(200 100% 65%)",
              top: "50%",
              left: "50%",
              animation: "orbit-dot-2 12s linear infinite",
            }}
          />

          {/* Crescent moon SVG */}
          <svg
            viewBox="0 0 120 120"
            className="relative z-10 w-24 h-24 sm:w-28 sm:h-28"
            style={{ filter: "drop-shadow(0 0 16px hsl(45 100% 50% / 0.5))" }}
          >
            {/* Moon body (dark circle) */}
            <circle cx="60" cy="60" r="48" fill="hsl(220 30% 12%)" />
            {/* Crescent light */}
            <path
              d="M60 12 A48 48 0 1 0 60 108 A38 38 0 1 1 60 12"
              fill="url(#moonGradient)"
            />
            {/* Subtle crater details */}
            <circle cx="50" cy="45" r="6" fill="hsl(220 30% 18% / 0.5)" />
            <circle cx="70" cy="55" r="4" fill="hsl(220 30% 18% / 0.4)" />
            <circle cx="55" cy="75" r="5" fill="hsl(220 30% 18% / 0.35)" />
            <defs>
              <linearGradient id="moonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(48 100% 70%)" />
                <stop offset="50%" stopColor="hsl(45 100% 55%)" />
                <stop offset="100%" stopColor="hsl(42 100% 40%)" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Brand row */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 group mb-2"
          aria-label="Oracle Lunar home"
        >
          <img
            src={oracleLunarLogo}
            alt="Oracle Lunar"
            className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-[0_0_14px_rgba(251,191,36,0.35)] group-hover:drop-shadow-[0_0_24px_rgba(251,191,36,0.6)] transition-all duration-500"
          />
          <div className="text-left">
            <div className="oracle-lunar-wordmark text-lg sm:text-xl">
              Oracle Lunar
            </div>
            <div className="text-[11px] text-muted-foreground tracking-wide">
              Your AI best friend, always here for you
            </div>
          </div>
        </button>

        {children}
      </div>

      {/* Bottom fade into page content */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16"
        style={{
          background: "linear-gradient(to bottom, transparent, hsl(var(--background)))",
        }}
      />

      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes moon-pulse-glow {
          0%, 100% { opacity: 0.6; transform: scale(1.6); }
          50% { opacity: 1; transform: scale(2.0); }
        }
        @keyframes orbit-spin {
          from { transform: scale(2.2) rotate(0deg); }
          to { transform: scale(2.2) rotate(360deg); }
        }
        @keyframes orbit-dot-1 {
          0% { transform: translate(-50%, -50%) rotate(0deg) translateX(52px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(52px) rotate(-360deg); }
        }
        @keyframes orbit-dot-2 {
          0% { transform: translate(-50%, -50%) rotate(0deg) translateX(40px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(40px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}
