// HeyGen affiliate CTA — single source of truth for the upsell card/button.
// When the real PartnerStack URL is pasted into HEYGEN_AFFILIATE_URL,
// every instance of this component activates automatically.
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Video } from "lucide-react";
import { HEYGEN_AFFILIATE_URL, trackAffiliateClick } from "@/lib/affiliateLinks";

const PLACEHOLDER_URL = "https://www.heygen.com/?sid=oraclelunar";

interface HeyGenAffiliateCTAProps {
  placement: string;
  variant?: "card" | "button" | "inline";
  title?: string;
  description?: string;
  ctaLabel?: string;
  className?: string;
}

export function HeyGenAffiliateCTA({
  placement,
  variant = "card",
  title = "Animate Your Story with HeyGen",
  description = "Turn your storyboard into a lifelike AI character video. 8K talking avatars, lip-sync, and 175+ voices.",
  ctaLabel = "Try HeyGen Free →",
  className = "",
}: HeyGenAffiliateCTAProps) {
  // Hide the CTA entirely until the real referral URL is wired in.
  // This way, no broken/placeholder links ever ship to users.
  const isLive = HEYGEN_AFFILIATE_URL && HEYGEN_AFFILIATE_URL !== PLACEHOLDER_URL;
  if (!isLive) return null;

  const handleClick = () => {
    trackAffiliateClick("heygen", placement);
    window.open(HEYGEN_AFFILIATE_URL, "_blank", "noopener,noreferrer,sponsored");
  };

  if (variant === "button") {
    return (
      <Button
        onClick={handleClick}
        variant="outline"
        className={`border-amber-500/50 text-amber-300 hover:bg-amber-500/10 ${className}`}
      >
        <Video className="mr-2 h-4 w-4" />
        {ctaLabel}
      </Button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        onClick={handleClick}
        className={`text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2 ${className}`}
      >
        {ctaLabel}
      </button>
    );
  }

  return (
    <Card
      className={`p-4 bg-gradient-to-br from-amber-950/40 to-background border-amber-500/30 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-500/20 p-2">
          <Sparkles className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-amber-100 text-sm mb-1">{title}</h4>
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
          <Button
            size="sm"
            onClick={handleClick}
            className="bg-amber-500 hover:bg-amber-600 text-background font-semibold"
          >
            {ctaLabel}
          </Button>
          <p className="text-[10px] text-muted-foreground/60 mt-2">
            Sponsored partner — Oracle Lunar earns a commission
          </p>
        </div>
      </div>
    </Card>
  );
}
