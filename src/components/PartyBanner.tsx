import { useNavigate } from "react-router-dom";
import { Crown, Gift, PartyPopper, Sparkles } from "lucide-react";

interface PartyBannerProps {
  variant: "lifetime-birthday" | "founding-member";
  className?: string;
}

/**
 * Festive promo banner used on the dashboard (lifetime birthday) and on the
 * public landing page (founding member access). Pure presentation — clicking
 * routes to the subscribe page.
 */
const PartyBanner = ({ variant, className = "" }: PartyBannerProps) => {
  const navigate = useNavigate();

  if (variant === "lifetime-birthday") {
    return (
      <div
        onClick={() => navigate("/subscribe")}
        className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-primary/60 bg-gradient-to-r from-primary/30 via-amber-500/30 to-primary/30 p-4 shadow-[0_0_30px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_45px_hsl(var(--primary)/0.6)] transition-all animate-pulse-slow ${className}`}
        role="button"
        aria-label="Lifetime Membership Birthday Party Offer"
      >
        {/* Confetti dots */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <span className="absolute top-2 left-4 text-lg">🎉</span>
          <span className="absolute top-3 right-6 text-lg">🎂</span>
          <span className="absolute bottom-2 left-10 text-lg">🎈</span>
          <span className="absolute bottom-3 right-10 text-lg">🎁</span>
          <span className="absolute top-1/2 left-1/3 text-lg">✨</span>
          <span className="absolute top-1/2 right-1/4 text-lg">🥳</span>
        </div>
        <div className="relative flex items-center gap-3">
          <div className="shrink-0 w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center">
            <PartyPopper className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Birthday Bash · Limited Offer
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-foreground leading-tight">
              🎂 Lifetime Membership Party!
            </h3>
            <p className="text-[11px] sm:text-xs text-foreground/80 mt-0.5">
              One payment of <span className="font-bold text-primary">$900</span> — every premium feature, forever. 🎁
            </p>
          </div>
          <div className="shrink-0 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 shadow-md">
            <Crown className="w-3 h-3" /> Claim
          </div>
        </div>
      </div>
    );
  }

  // founding-member
  return (
    <div
      onClick={() => navigate("/subscribe")}
      className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-primary/60 bg-gradient-to-r from-amber-500/25 via-primary/30 to-amber-500/25 p-5 shadow-[0_0_40px_hsl(var(--primary)/0.45)] hover:shadow-[0_0_55px_hsl(var(--primary)/0.65)] transition-all ${className}`}
      role="button"
      aria-label="Founding Member Access and Prizes"
    >
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <span className="absolute top-2 left-6 text-xl">👑</span>
        <span className="absolute top-3 right-8 text-xl">🏆</span>
        <span className="absolute bottom-3 left-12 text-xl">🎁</span>
        <span className="absolute bottom-2 right-12 text-xl">✨</span>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 text-xl">⭐</span>
      </div>
      <div className="relative flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
        <div className="shrink-0 w-14 h-14 rounded-full bg-primary/30 flex items-center justify-center ring-2 ring-primary/50">
          <Crown className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-1 text-[10px] font-bold text-primary uppercase tracking-widest">
            <Sparkles className="w-3 h-3" /> Special · Founding Members Only
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-foreground leading-tight mt-0.5">
            🏆 Founding Member Access &amp; Prizes
          </h3>
          <p className="text-xs sm:text-sm text-foreground/85 mt-1">
            Be one of the first to join — unlock <span className="font-bold text-primary">premium features</span>,
            exclusive prizes, and a permanent <span className="font-bold text-primary">Founder badge</span>.
            Limited spots available!
          </p>
        </div>
        <div className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground text-sm font-bold flex items-center gap-2 shadow-lg whitespace-nowrap">
          <Gift className="w-4 h-4" /> Become a Founder
        </div>
      </div>
    </div>
  );
};

export default PartyBanner;
