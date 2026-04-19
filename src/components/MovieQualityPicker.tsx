// Quality picker — slideshow edition (SD 720p / HD 1080p only).
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { QUALITY_TIERS, type RenderQualityTier } from "@/lib/moviePaywall";

interface Props {
  value: RenderQualityTier;
  onChange: (q: RenderQualityTier) => void;
  durationMin: number;
  isAdmin?: boolean;
  /** Free users are locked to SD 720p. */
  isFreeTier?: boolean;
}

export const MovieQualityPicker = ({ value, onChange, durationMin, isAdmin, isFreeTier }: Props) => {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Render quality</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {QUALITY_TIERS.map(t => {
          const locked = t.ultimate && !(isAdmin || isLifetime);
          const totalCost = ((t.pricePerMinCents * durationMin) / 100).toFixed(2);
          const selected = value === t.key;
          return (
            <button
              key={t.key}
              onClick={() => !locked && onChange(t.key)}
              disabled={locked}
              className={`relative text-left p-3 rounded-lg border transition-all ${
                selected ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.3)]" :
                locked ? "border-border/30 bg-muted/20 opacity-60 cursor-not-allowed" :
                "border-border/50 hover:border-primary/40 hover:bg-muted/40"
              } ${t.ultimate ? "ring-1 ring-primary/30" : ""}`}
            >
              {t.badge && (
                <Badge className={`absolute -top-2 -right-2 text-[9px] ${t.ultimate ? "bg-gradient-to-r from-primary to-yellow-500" : ""}`}>
                  {t.badge}
                </Badge>
              )}
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1">
                  {t.ultimate && <Crown className="w-3 h-3 text-primary" />}
                  <span className="text-sm font-bold">{t.label}</span>
                </div>
                {locked && <Lock className="w-3 h-3 text-muted-foreground" />}
              </div>
              <p className="text-[10px] text-muted-foreground">{t.resolution}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{t.description}</p>
              <div className="mt-2 pt-2 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground">${(t.pricePerMinCents / 100).toFixed(2)}/min</p>
                <p className="text-sm font-bold text-primary">${totalCost}</p>
                <p className="text-[9px] text-muted-foreground">total for {durationMin}min</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        All prices include +5% provider markup. You can pause or cancel mid-render — you only pay for completed scenes.
      </p>
    </div>
  );
};

export default MovieQualityPicker;
