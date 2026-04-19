import { Shield, Mic, Volume2, AlertTriangle } from "lucide-react";
import type { AudioFilterStatus, FilterTier } from "@/lib/audioFilter";
import { MLSC_TOTAL_LAYERS } from "@/lib/audioFilter";
import MlscLogo from "@/components/MlscLogo";

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

interface ExtendedProps extends Props {
  learnedCount?: number;
  currentMatchLabel?: string | null;
}

export default function AudioFilterHUD({ status, onEnroll, learnedCount, currentMatchLabel }: ExtendedProps) {
  if (!status) return null;

  return (
    <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-primary/20 bg-background/80 p-2 text-[10px] shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 pb-1 border-b border-primary/10">
        <MlscLogo className="h-5 w-5" />
        <span className="font-bold text-[11px] bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
          MLSC ACTIVE
        </span>
        <span className="ml-auto text-muted-foreground">{MLSC_TOTAL_LAYERS.toLocaleString()} layers</span>
      </div>

      <div className={`flex items-center gap-1 rounded border px-2 py-0.5 ${MODE_COLORS[status.mode]}`}>
        <Shield className="h-3 w-3" />
        <span className="font-semibold uppercase">{MODE_ICON[status.mode]} {status.mode}</span>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground">
        <Volume2 className="h-3 w-3" />
        <span>{Math.round(status.ambientDb)} dB</span>
        {status.vadActive && <span className="text-primary">● voice</span>}
        {status.oracleSpeaking && <span className="text-amber-400">● oracle</span>}
      </div>

      <div className="flex items-center gap-2">
        <Mic className="h-3 w-3" />
        <div className="h-1 flex-1 overflow-hidden rounded bg-muted">
          <div
            className="h-full bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 via-blue-400 to-violet-400 transition-all"
            style={{ width: `${Math.round(status.voiceMatch * 100)}%` }}
          />
        </div>
        <span className="text-muted-foreground">{Math.round(status.voiceMatch * 100)}%</span>
      </div>

      {typeof learnedCount === "number" && (
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="text-primary">🧠</span>
          <span>{learnedCount} sounds learned</span>
          {currentMatchLabel && <span className="ml-auto text-primary truncate max-w-[120px]">{currentMatchLabel}</span>}
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

      {onEnroll && (
        <button onClick={onEnroll} className="text-[9px] text-muted-foreground hover:text-primary underline">
          Re-sync my voice
        </button>
      )}
    </div>
  );
}
