import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Floating prize balloons — big & small, no full-width banners that obscure the portal.
 * Every balloon routes the user to sign-up → dashboard so they land inside the app
 * as a member.
 */

type Balloon = {
  key: string;
  label: string;
  emoji: string;
  sub: string;
  size: "xl" | "lg" | "md" | "sm";
  hue: string; // tailwind gradient stops
  ring: string; // border color
  glow: string; // box-shadow color
  to: string;
  // absolute placement
  pos: string;
  // gentle bob animation delay
  delay: string;
};

const BALLOONS: Balloon[] = [
  {
    key: "lifetime",
    label: "LIFETIME",
    emoji: "👑",
    sub: "One payment · Forever access · 75% OFF",
    size: "xl",
    hue: "from-amber-300 via-yellow-500 to-amber-700",
    ring: "border-yellow-200",
    glow: "shadow-[0_0_60px_rgba(250,204,21,0.9),0_0_120px_rgba(245,158,11,0.6)]",
    to: "/subscribe?plan=lifetime",
    pos: "top-[18%] left-[6%]",
    delay: "0s",
  },
  {
    key: "annual",
    label: "12 MONTHS",
    emoji: "🎁",
    sub: "Full Access · $80 AUD",
    size: "lg",
    hue: "from-fuchsia-400 via-pink-500 to-rose-700",
    ring: "border-pink-200",
    glow: "shadow-[0_0_45px_rgba(236,72,153,0.85)]",
    to: "/subscribe?plan=annual",
    pos: "top-[10%] right-[8%]",
    delay: "0.4s",
  },
  {
    key: "starter",
    label: "$5/mo",
    emoji: "🚀",
    sub: "Starter tier",
    size: "md",
    hue: "from-sky-300 via-cyan-500 to-blue-700",
    ring: "border-sky-200",
    glow: "shadow-[0_0_35px_rgba(14,165,233,0.8)]",
    to: "/subscribe?plan=starter",
    pos: "top-[42%] left-[2%]",
    delay: "0.9s",
  },
  {
    key: "freetrial",
    label: "14-DAY",
    emoji: "🎈",
    sub: "Free trial",
    size: "md",
    hue: "from-lime-300 via-green-500 to-emerald-700",
    ring: "border-lime-200",
    glow: "shadow-[0_0_35px_rgba(34,197,94,0.8)]",
    to: "/sign-in?redirect=/dashboard&trial=1",
    pos: "top-[56%] right-[3%]",
    delay: "1.3s",
  },
  {
    key: "refer",
    label: "REFER",
    emoji: "💚",
    sub: "Friend joins → 1 month free",
    size: "sm",
    hue: "from-teal-300 via-emerald-500 to-green-700",
    ring: "border-teal-200",
    glow: "shadow-[0_0_25px_rgba(20,184,166,0.8)]",
    to: "/sign-in?redirect=/referral",
    pos: "top-[72%] left-[14%]",
    delay: "1.7s",
  },
  {
    key: "vip",
    label: "VIP",
    emoji: "✨",
    sub: "Golden Heart",
    size: "sm",
    hue: "from-yellow-200 via-amber-400 to-orange-600",
    ring: "border-yellow-100",
    glow: "shadow-[0_0_25px_rgba(251,191,36,0.85)]",
    to: "/subscribe?plan=golden",
    pos: "top-[80%] right-[18%]",
    delay: "2.1s",
  },
  {
    key: "quarter",
    label: "3 MO",
    emoji: "🎊",
    sub: "$20 AUD",
    size: "sm",
    hue: "from-violet-300 via-purple-500 to-indigo-700",
    ring: "border-violet-200",
    glow: "shadow-[0_0_25px_rgba(139,92,246,0.85)]",
    to: "/subscribe?plan=quarterly",
    pos: "top-[30%] right-[22%]",
    delay: "2.4s",
  },
];

const sizeClasses: Record<Balloon["size"], string> = {
  xl: "h-44 w-44 md:h-52 md:w-52 text-base",
  lg: "h-32 w-32 md:h-40 md:w-40 text-sm",
  md: "h-24 w-24 md:h-28 md:w-28 text-xs",
  sm: "h-20 w-20 md:h-24 md:w-24 text-[11px]",
};

export const FloatingOffersField = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = (to: string) => {
    if (user) {
      // If already signed in, send straight to the destination (or dashboard for trials)
      navigate(to.startsWith("/sign-in") ? "/dashboard" : to);
    } else {
      // Force registration: pass the original target as redirect → land on dashboard after auth
      const redirect = to.startsWith("/sign-in") ? to : `/sign-in?redirect=${encodeURIComponent(to)}`;
      navigate(redirect);
    }
  };

  return (
    <>
      <style>{`
        @keyframes balloon-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-14px) rotate(2deg); }
        }
        .balloon-bob { animation: balloon-bob 5s ease-in-out infinite; }
        .balloon-string {
          position: absolute; left: 50%; bottom: -38px;
          width: 2px; height: 38px; transform: translateX(-50%);
          background: linear-gradient(to bottom, rgba(255,255,255,0.7), transparent);
        }
      `}</style>

      <div
        aria-hidden="false"
        className="pointer-events-none absolute inset-x-0 top-[120px] h-[820px] z-20"
      >
        {BALLOONS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => handleClick(b.to)}
            aria-label={`${b.label} — ${b.sub}. Sign up to claim.`}
            className={`pointer-events-auto absolute ${b.pos} ${sizeClasses[b.size]} rounded-full border-[3px] ${b.ring} ${b.glow} balloon-bob bg-gradient-to-br ${b.hue} flex flex-col items-center justify-center text-center px-2 hover:scale-110 transition-transform`}
            style={{
              animationDelay: b.delay,
              fontFamily: "'Pacifico', 'Caveat', 'Comic Sans MS', cursive",
            }}
          >
            <span className="balloon-string" aria-hidden="true" />
            <div className="text-2xl md:text-3xl leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]">
              {b.emoji}
            </div>
            <div className="text-white font-bold leading-tight mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {b.label}
            </div>
            <div className="text-white/95 text-[10px] md:text-xs leading-tight mt-0.5 px-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {b.sub}
            </div>
          </button>
        ))}
      </div>
    </>
  );
};

export default FloatingOffersField;
