import { useEffect, useState } from "react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Shield, Mic, Trash2, Volume2, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAudioFilter } from "@/hooks/useAudioFilter";
import { useNoiseLearning } from "@/hooks/useNoiseLearning";
import { clearVoicePrint, loadVoicePrint, MLSC_TOTAL_LAYERS, type FilterMode } from "@/lib/audioFilter";
import VoiceEnrollmentDialog from "@/components/VoiceEnrollmentDialog";
import AudioFilterHUD from "@/components/AudioFilterHUD";
import MlscLogo from "@/components/MlscLogo";
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

const MLSC_GLOBAL_KEY = "oracle-lunar-mlsc-enabled";

export default function AudioFilterPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(MLSC_GLOBAL_KEY) !== "0"; } catch { return true; }
  });
  const [forced, setForced] = useState<FilterMode | undefined>(undefined);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const { stream, analyser, status, error, needsEnrollment, setNeedsEnrollment } = useAudioFilter({ enabled: active, forcedMode: forced });
  const { signatures, currentMatch, learnedCount, unknownCount } = useNoiseLearning({ analyser, active });
  const hasPrint = !!loadVoicePrint();

  const toggleGlobal = (next: boolean) => {
    setGlobalEnabled(next);
    try { localStorage.setItem(MLSC_GLOBAL_KEY, next ? "1" : "0"); } catch {}
    window.dispatchEvent(new CustomEvent("mlsc-toggle", { detail: { enabled: next } }));
    toast.success(next ? "MLSC layer enabled app-wide" : "MLSC layer disabled");
  };

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
            <MlscLogo size="lg" />
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                MLSC — Multi-Layering Super Clarity
              </h1>
              <p className="text-xs text-muted-foreground">Free for everyone. App-wide. Always-on.</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            <strong className="text-primary">{MLSC_TOTAL_LAYERS.toLocaleString()}</strong> micro-filter layers + a learning brain that
            remembers every noise in your world. Sirens, TVs, dishes, traffic, neighbours, pets — Oracle hears <strong>only you</strong>,
            and gets faster the more you use it.
          </p>
        </header>

        <Card className="p-4 space-y-4 bg-gradient-to-br from-primary/10 to-amber-500/5 border-primary/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> MLSC layer (app-wide)</p>
              <p className="text-xs text-muted-foreground">Master switch — enables MLSC for every voice feature: Oracle, calls, vision, transcripts.</p>
            </div>
            <Switch checked={globalEnabled} onCheckedChange={toggleGlobal} />
          </div>
        </Card>

        <Card className="p-4 space-y-4 bg-card border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Live filter (test on this device)</p>
              <p className="text-xs text-muted-foreground">Preview the pipeline using your mic right now.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} disabled={!globalEnabled} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {active && status && (
            <div className="flex flex-wrap items-start gap-3">
              <AudioFilterHUD
                status={status}
                tier="elite"
                learnedCount={learnedCount}
                currentMatchLabel={currentMatch?.label || null}
              />
              <div className="text-xs text-muted-foreground space-y-1 flex-1 min-w-[200px]">
                <p>Force mode (skip auto-detect):</p>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant={forced === undefined ? "default" : "outline"} onClick={() => setForced(undefined)}>Auto</Button>
                  {MODES.map(m => (
                    <Button key={m} size="sm" variant={forced === m ? "default" : "outline"} onClick={() => setForced(m)} className="capitalize">{m}</Button>
                  ))}
                </div>
                <p className="pt-2"><strong className="text-primary">{unknownCount}</strong> new sounds learned this session</p>
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
          <p className="font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Learned sound library
            <span className="ml-auto text-xs text-muted-foreground">{signatures.length} signatures</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Every noise the AI hears for ~600ms gets fingerprinted and saved. Next time, recognition is instant — your environment becomes silent to Oracle.
          </p>
          {signatures.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Turn on the live filter to start building your library.</p>
          ) : (
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs">
              {signatures.slice(0, 30).map((s) => (
                <li key={s.id} className={`rounded px-2 py-1 border ${s.source === "user" ? "bg-primary/10 border-primary/30" : "bg-muted border-muted-foreground/20"}`}>
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{s.category} · {s.action}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 space-y-2 bg-card border-primary/20">
          <p className="font-semibold flex items-center gap-2"><Volume2 className="h-4 w-4" /> Pipeline architecture</p>
          <ul className="space-y-1 text-sm">
            {LAYERS.map(l => (
              <li key={l.idx} className="flex items-center gap-2 rounded px-2 py-1 text-foreground">
                <span className="text-xs font-mono w-6 text-primary">{String(l.idx).padStart(2, "0")}</span>
                <span className="flex-1">{l.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary">✓ Active</span>
              </li>
            ))}
            <li className="flex items-center gap-2 rounded px-2 py-1 text-muted-foreground border-t border-primary/10 mt-2 pt-2">
              <span className="text-xs font-mono w-6 text-primary">+</span>
              <span className="flex-1">{(MLSC_TOTAL_LAYERS - 20).toLocaleString()} micro-refinement layers (multi-band gating, perceptual weighting, learned-noise subtraction…)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary">✓ Active</span>
            </li>
          </ul>
        </Card>
      </div>

      <VoiceEnrollmentDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  );
}
