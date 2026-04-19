import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import oracle-lunarBanner from "@/assets/oracle-lunar-banner.jpg";
import { useSiteContent } from "@/hooks/useSiteContent";

interface IntroSplashProps {
  onComplete: () => void;
}

const IntroSplash = ({ onComplete }: IntroSplashProps) => {
  const [visible, setVisible] = useState(true);
  const { get } = useSiteContent();
  const banner = get("landing", "free_trial_banner", "🎁 Sign up free — 30 days of full access, no card required");
  const tagline = get("landing", "hero_tagline", "Oracle Lunar, your AI companion to do everything!");

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 500);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col items-center justify-end transition-opacity duration-500 cursor-pointer ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={() => {
        setVisible(false);
        setTimeout(onComplete, 500);
      }}
    >
      {/* Full-bleed banner background */}
      <img
        src={oracle-lunarBanner}
        alt="Oracle Lunar Banner"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Sound toggle top-right */}
      <button className="absolute top-4 right-4 z-10 text-primary opacity-80 hover:opacity-100 transition-opacity">
        <Volume2 className="w-6 h-6" />
      </button>

      {/* Tagline + free-trial banner at bottom */}
      <div className="relative z-10 pb-8 animate-slide-up flex flex-col items-center gap-3 px-4">
        <div className="px-4 py-2 rounded-full bg-gradient-to-r from-primary/90 to-amber-500/90 text-primary-foreground text-sm font-bold shadow-[0_0_25px_hsl(var(--primary)/0.5)] border border-primary/40">
          🎁 Sign up free — 30 days of full access, no card required
        </div>
        <div className="px-4 py-2 rounded-full bg-gradient-to-r from-primary/90 to-amber-500/90 text-primary-foreground text-sm font-bold shadow-[0_0_25px_hsl(var(--primary)/0.5)] border border-primary/40">
          {banner}
        </div>
        <p className="text-2xl md:text-3xl font-bold drop-shadow-lg text-foreground">
          {tagline}
        </p>
      </div>
    </div>
  );
};

export default IntroSplash;
