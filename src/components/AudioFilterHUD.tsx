import { Shield, Mic, Volume2, AlertTriangle } from "lucide-react";
import type { AudioFilterStatus, FilterTier } from "@/lib/audioFilter";
import { tierMaxLayer } from "@/lib/audioFilter";

interface Props {
  status: AudioFilterStatus | null;
  tier: FilterTier;
  onUpgrade?: () => void;
  onEnroll?: () => void;
}

const MODE_COLORS: Record<string, string> = {
  quiet: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  normal: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  street: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  chaos: "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse",
};

const MODE_ICON: Record<string, string> = { quiet: "🟢", normal: "🟡", street: "🟠", chaos: "🔴" };

export default function AudioFilterHUD({ status, tier, onUpgrade, onEnroll }: Props) {
  if (!status) return null;
  const max = tierMaxLayer(tier);

  return (
    <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-primary/20 bg-background/80 p-2 text-[10px] shadow-lg backdrop-blur">
      <div className={`flex items-center gap-1 rounded border px-2 py-0.5 ${MODE_COLORS[status.mode]}`}>
        <Shield className="h-3 w-3" />
        <span className="font-semibold uppercase">{MODE_ICON[status.mode]} {status.mode}</span>
        <span className="ml-auto opacity-70">{max}/20 layers</span>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground">
        <Volume2 className="h-3 w-3" />
        <span>{Math.round(status.ambientDb)} dB</span>
        {status.vadActive && <span className="text-primary">● voice</span>}
        {status.oracleSpeaking && <span className="text-amber-400">● oracle</span>}
      </div>

      {max >= 3 && (
        <div className="flex items-center gap-2">
          <Mic className="h-3 w-3" />
          <div className="h-1 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round(status.voiceMatch * 100)}%` }}
            />
          </div>
          <span className="text-muted-foreground">{Math.round(status.voiceMatch * 100)}%</span>
        </div>
      )}

      {(status.sirenDetected || status.tvDetected) && (
        <div className="flex items-center gap-1 text-rose-300">
          <AlertTriangle className="h-3 w-3" />
          {status.sirenDetected && <span>siren</span>}
          {status.tvDetected && <span>tv</span>}
        </div>
      )}

      {status.pushToTalkRequired && (
        <div className="rounded bg-rose-500/20 px-2 py-0.5 text-rose-300">Hold to talk</div>
      )}

      {tier !== "elite" && onUpgrade && (
        <button
          onClick={onUpgrade}
          className="mt-1 rounded bg-primary/20 px-2 py-0.5 text-primary hover:bg-primary/30"
        >
          Unlock {tier === "free" ? "16" : tier === "starter" ? "12" : "6"} more layers →
        </button>
      )}

      {onEnroll && (
        <button onClick={onEnroll} className="text-[9px] text-muted-foreground hover:text-primary underline">
          Re-sync my voice
        </button>
      )}
    </div>
  );
}
