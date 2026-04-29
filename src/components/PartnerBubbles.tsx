// Floating partner-promo bubbles — appear at the bottom of the portal landing page.
// Drift gently, scale on hover, open the partner's affiliate link in a new tab.
// HeyGen bubble auto-hides while the affiliate URL is still the placeholder.
import heygenBubble from "@/assets/partner-bubble-heygen.png";
import elevenLabsBubble from "@/assets/partner-bubble-elevenlabs.png";
import {
  ELEVENLABS_AFFILIATE_URL,
  HEYGEN_AFFILIATE_URL,
  trackAffiliateClick,
} from "@/lib/affiliateLinks";

const HEYGEN_PLACEHOLDER = "https://www.heygen.com/?sid=oraclelunar";

interface Bubble {
  key: string;
  label: string;
  tagline: string;
  img: string;
  url: string;
  partner: string;
  hidden?: boolean;
}

const PartnerBubbles = () => {
  const bubbles: Bubble[] = [
    {
      key: "elevenlabs",
      label: "ElevenLabs",
      tagline: "AI Voices",
      img: elevenLabsBubble,
      url: ELEVENLABS_AFFILIATE_URL,
      partner: "elevenlabs",
    },
    {
      key: "heygen",
      label: "HeyGen",
      tagline: "AI Avatars",
      img: heygenBubble,
      url: HEYGEN_AFFILIATE_URL,
      partner: "heygen",
      hidden: HEYGEN_AFFILIATE_URL === HEYGEN_PLACEHOLDER,
    },
  ].filter((b) => !b.hidden);

  if (bubbles.length === 0) return null;

  return (
    <section
      aria-label="Partner integrations"
      className="relative w-full px-4 py-10 mt-6"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-400/70 mb-1">
            Powered by world-class AI partners
          </p>
          <h3 className="text-lg sm:text-xl font-semibold text-foreground/90">
            Tools that supercharge your creations
          </h3>
        </div>

        <div className="flex items-end justify-center gap-6 sm:gap-12 flex-wrap">
          {bubbles.map((b, i) => (
            <a
              key={b.key}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => trackAffiliateClick(b.partner, "portal_home_bubble")}
              className="group flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-full"
              style={{
                animation: `bubbleFloat 6s ease-in-out ${i * 0.8}s infinite`,
              }}
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-2xl scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img
                  src={b.img}
                  alt={`${b.label} — ${b.tagline}`}
                  width={120}
                  height={120}
                  loading="lazy"
                  className="relative w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-110 group-active:scale-95"
                />
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-foreground">{b.label}</div>
                <div className="text-[11px] text-muted-foreground">{b.tagline}</div>
              </div>
            </a>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center mt-4">
          Sponsored partners — Oracle Lunar may earn a commission
        </p>
      </div>

      {/* Floating animation — keyframes scoped to this section via a style tag */}
      <style>{`
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
      `}</style>
    </section>
  );
};

export default PartnerBubbles;
