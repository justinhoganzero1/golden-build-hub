// HeyGen upsell card — now routes through our in-app white-label proxy so the
// user pays coins and stays inside Oracle Lunar. No outbound third-party links.
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Video } from "lucide-react";
import { useFeatureProxy } from "@/lib/featureProxy";

interface HeyGenAffiliateCTAProps {
  placement: string;
  variant?: "card" | "button" | "inline";
  title?: string;
  description?: string;
  ctaLabel?: string;
  className?: string;
  /** Which proxied feature to unlock. Defaults to talking avatar. */
  featureId?: string;
}

export function HeyGenAffiliateCTA({
  placement,
  variant = "card",
  title = "Animate Your Story",
  description = "Turn your storyboard into a lifelike AI character video. 4K talking avatars, perfect lip-sync, and 175+ voices — all inside Oracle Lunar.",
  ctaLabel = "Unlock with coins →",
  className = "",
  featureId = "hg-avatar",
}: HeyGenAffiliateCTAProps) {
  const { open } = useFeatureProxy();
  const handleClick = () => open(featureId, placement);

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
    <Card className={`p-4 bg-gradient-to-br from-amber-950/40 to-background border-amber-500/30 ${className}`}>
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
            Pay once with coins — stay in Oracle Lunar.
          </p>
        </div>
      </div>
    </Card>
  );
}
