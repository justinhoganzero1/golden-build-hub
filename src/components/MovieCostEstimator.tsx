// Live cost preview. Mirrors the PRICING table in movie-project-create so the user
// sees the exact charge BEFORE they click create.
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Coins, Wallet, Crown } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCentsAsCoins } from "@/lib/coins";

const PRICING_CENTS_PER_MIN: Record<string, number> = {
  sd: 50, hd: 200, "4k": 800, "8k_ultimate": 5000,
};
const QUALITY_LABEL: Record<string, string> = {
  sd: "SD 720p", hd: "HD 1080p", "4k": "4K Pro", "8k_ultimate": "🏆 ULTIMATE 8K",
};

interface Props {
  walletBalanceCents: number;
  defaultDurationMin?: number;
  defaultQuality?: keyof typeof PRICING_CENTS_PER_MIN;
  maxDurationMin?: number;
  onChange?: (cfg: { duration: number; quality: string; estimateCents: number }) => void;
}

export const MovieCostEstimator = ({
  walletBalanceCents, defaultDurationMin = 5, defaultQuality = "hd",
  maxDurationMin = 30, onChange,
}: Props) => {
  const [duration, setDuration] = useState(defaultDurationMin);
  const [quality, setQuality] = useState<string>(defaultQuality);

  const estimateCents = useMemo(() => {
    return Math.ceil(duration * (PRICING_CENTS_PER_MIN[quality] ?? 200));
  }, [duration, quality]);

  const sufficient = walletBalanceCents >= estimateCents;
  const shortfall = sufficient ? 0 : estimateCents - walletBalanceCents;

  const update = (d: number, q: string) => {
    setDuration(d); setQuality(q);
    onChange?.({ duration: d, quality: q, estimateCents: Math.ceil(d * (PRICING_CENTS_PER_MIN[q] ?? 200)) });
  };

  return (
    <Card className="p-4 space-y-3 bg-muted/30 border-primary/20">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" /> Live cost estimate
        </h4>
        <Badge variant={sufficient ? "default" : "destructive"} className="text-[10px]">
          {sufficient ? "Wallet OK" : `Need ${formatCentsAsCoins(shortfall)} more coins`}
        </Badge>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span>Duration</span><span className="font-bold">{duration} min</span>
        </div>
        <Slider value={[duration]} min={1} max={maxDurationMin} step={1}
          onValueChange={(v) => update(v[0], quality)} />
      </div>

      <div>
        <p className="text-xs mb-1.5">Quality</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.keys(PRICING_CENTS_PER_MIN).map(q => (
            <button key={q}
              onClick={() => update(duration, q)}
              className={`p-2 rounded-md text-[11px] border transition-all ${
                quality === q
                  ? "bg-primary/20 border-primary text-foreground font-bold"
                  : "bg-background border-border/50 text-muted-foreground hover:border-primary/50"
              }`}
            >
              {q === "8k_ultimate" && <Crown className="w-3 h-3 inline mr-1 text-primary" />}
              {QUALITY_LABEL[q]}
              <div className="text-[9px] opacity-70">{formatCentsAsCoins(PRICING_CENTS_PER_MIN[q])} / min</div>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Wallet className="w-3 h-3" /> Total charge
        </span>
        <span className="text-lg font-bold text-primary">${(estimateCents / 100).toFixed(2)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Includes provider cost + 5% platform fee. Refunded per-scene if render fails.
      </p>
    </Card>
  );
};

export default MovieCostEstimator;
