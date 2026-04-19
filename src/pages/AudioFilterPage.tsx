import { useEffect, useState } from "react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Shield, Mic, Trash2, Crown, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAudioFilter } from "@/hooks/useAudioFilter";
import { tierMaxLayer, clearVoicePrint, loadVoicePrint, type FilterMode } from "@/lib/audioFilter";
import VoiceEnrollmentDialog from "@/components/VoiceEnrollmentDialog";
import AudioFilterHUD from "@/components/AudioFilterHUD";
import { toast } from "sonner";

const LAYERS: { idx: number; name: string; tier: string }[] = [
  { idx: 1, name: "Browser AEC + Noise Suppress + AGC", tier: "Free" },
  { idx: 2, name: "Adaptive noise gate", tier: "Starter" },
  { idx: 3, name: "Voice profile (5s sync + passive learning)", tier: "Starter" },
  { idx: 4, name: "Oracle TTS mute window", tier: "Free" },
  { idx: 5, name: "Adaptive noise floor calibration", tier: "Starter" },
  { idx: 6, name: "Spectral subtraction (HP/LP filter)", tier: "Starter" },
  { idx: 7, name: "Voice Activity Detection", tier: "Starter" },
  { idx: 8, name: "Confidence-weighted transcript filter", tier: "Starter" },
  { idx: 9, name: "Proximity gate (loudness floor)", tier: "Pro" },
  { idx: 10, name: "Wake-phrase mode (Hey Oracle)", tier: "Pro" },
  { idx: 11, name: "Echo / playback suppression", tier: "Pro" },
  { idx: 12, name: "Street Mode auto-detect", tier: "Pro" },
  { idx: 13, name: "Siren / alarm rejection", tier: "Pro" },
  { idx: 14, name: "TV / continuous-speech rejection", tier: "Pro" },
  { idx: 15, name: "Transient suppression (dishes, claps)", tier: "Elite" },
  { idx: 16, name: "Dual-voice separation (you vs flatmate)", tier: "Elite" },
  { idx: 17, name: "Direction-of-arrival (stereo)", tier: "Elite" },
  { idx: 18, name: "RNNoise-style aggressive suppression", tier: "Elite" },
  { idx: 19, name: "Dynamic ducking when Oracle speaks", tier: "Elite" },
  { idx: 20, name: "Push-to-talk emergency mode (>80dB)", tier: "Elite" },
];

const MODES: FilterMode[] = ["quiet", "normal", "street", "chaos"];

export default function AudioFilterPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [forced, setForced] = useState<FilterMode | undefined>(undefined);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const { stream, status, tier, error, needsEnrollment, setNeedsEnrollment } = useAudioFilter({ enabled: active, forcedMode: forced });
  const max = tierMaxLayer(tier);
  const hasPrint = !!loadVoicePrint();

  useEffect(() => {
    if (needsEnrollment) {
      setEnrollOpen(true);
      setNeedsEnrollment(false);
    }
  }, [needsEnrollment, setNeedsEnrollment]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <UniversalBackButton />

      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary">Audio Filter Fortress</h1>
          </div>
          <p className="text-muted-foreground">
            20-layer mic pipeline. Sirens, TVs, dishes, traffic — Oracle hears <strong>only you</strong>.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Crown className="h-4 w-4 text-primary" />
            <span>Your tier: <strong className="text-primary uppercase">{tier}</strong></span>
            <span className="text-muted-foreground">— {max} of 20 layers active</span>
          </div>
        </header>

        <Card className="p-4 space-y-4 bg-card border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Live filter</p>
              <p className="text-xs text-muted-foreground">Test the pipeline on this device.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {active && status && (
            <div className="flex flex-wrap items-start gap-3">
              <AudioFilterHUD status={status} tier={tier} onUpgrade={() => navigate("/subscribe")} />
              <div className="text-xs text-muted-foreground space-y-1 flex-1 min-w-[200px]">
                <p>Force mode (skip auto-detect):</p>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant={forced === undefined ? "default" : "outline"} onClick={() => setForced(undefined)}>Auto</Button>
                  {MODES.map(m => (
                    <Button key={m} size="sm" variant={forced === m ? "default" : "outline"} onClick={() => setForced(m)} className="capitalize">{m}</Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-3 bg-card border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold flex items-center gap-2"><Mic className="h-4 w-4" /> Voice profile</p>
              <p className="text-xs text-muted-foreground">
                {hasPrint ? "Saved on this device. Passive learning is improving it as you talk." : "Not yet enrolled."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setEnrollOpen(true)}>
                {hasPrint ? "Re-sync" : "Sync voice"}
              </Button>
              {hasPrint && (
                <Button size="sm" variant="outline" onClick={() => { clearVoicePrint(); toast.success("Voice profile cleared."); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-2 bg-card border-primary/20">
          <p className="font-semibold flex items-center gap-2"><Volume2 className="h-4 w-4" /> All 20 layers</p>
          <ul className="space-y-1 text-sm">
            {LAYERS.map(l => {
              const unlocked = l.idx <= max;
              return (
                <li key={l.idx} className={`flex items-center gap-2 rounded px-2 py-1 ${unlocked ? "text-foreground" : "text-muted-foreground/60"}`}>
                  <span className={`text-xs font-mono w-6 ${unlocked ? "text-primary" : ""}`}>{String(l.idx).padStart(2, "0")}</span>
                  <span className="flex-1">{l.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${unlocked ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {unlocked ? "✓ Active" : l.tier}
                  </span>
                </li>
              );
            })}
          </ul>

          {tier !== "elite" && (
            <Button onClick={() => navigate("/subscribe")} className="w-full mt-3 bg-primary text-primary-foreground">
              <Crown className="mr-2 h-4 w-4" /> Unlock all 20 layers
            </Button>
          )}
        </Card>
      </div>

      <VoiceEnrollmentDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  );
}
