import { useEffect, useState } from "react";
import { Headphones, Mic, Volume2, RefreshCw, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import AudioTestWidget from "@/components/AudioTestWidget";
import { trackAudioEvent, summarizeAudioEvents, clearAudioEvents } from "@/lib/audioAnalytics";
import { toast } from "sonner";

interface DeviceInfo { deviceId: string; label: string; kind: MediaDeviceKind; }

const AudioDiagnosticsPage = () => {
  const [inputs, setInputs] = useState<DeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<DeviceInfo[]>([]);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied" | "prompt">("unknown");
  const [streamActive, setStreamActive] = useState(false);
  const [summary, setSummary] = useState(() => summarizeAudioEvents());

  const refresh = async () => {
    try {
      // Try to read permission state if supported
      try {
        // @ts-expect-error microphone perm string is supported in most browsers
        const status = await navigator.permissions?.query({ name: "microphone" });
        if (status?.state) setPermission(status.state as any);
      } catch { /* ignore */ }

      const devs = await navigator.mediaDevices.enumerateDevices();
      setInputs(devs.filter(d => d.kind === "audioinput").map(d => ({ deviceId: d.deviceId, label: d.label || "Unnamed input", kind: d.kind })));
      setOutputs(devs.filter(d => d.kind === "audiooutput").map(d => ({ deviceId: d.deviceId, label: d.label || "Unnamed output", kind: d.kind })));
      trackAudioEvent("device_enumerated", { in: devs.filter(d => d.kind === "audioinput").length, out: devs.filter(d => d.kind === "audiooutput").length });
      setSummary(summarizeAudioEvents());
    } catch (e: any) {
      toast.error("Could not enumerate audio devices");
      console.error(e);
    }
  };

  useEffect(() => { refresh(); }, []);

  const probeStream = async () => {
    trackAudioEvent("permission_requested");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStreamActive(stream.getAudioTracks().some(t => t.readyState === "live"));
      setPermission("granted");
      trackAudioEvent("permission_granted");
      toast.success("Microphone stream active ✓");
      // Refresh now that labels are unlocked
      await refresh();
      // Stop after a moment so we don't keep the mic hot
      setTimeout(() => {
        stream.getTracks().forEach(t => t.stop());
        setStreamActive(false);
      }, 1500);
    } catch (e: any) {
      setPermission("denied");
      trackAudioEvent("permission_denied", { error: e?.message });
      toast.error("Microphone access blocked");
    }
    setSummary(summarizeAudioEvents());
  };

  const reset = () => {
    clearAudioEvents();
    setSummary(summarizeAudioEvents());
    toast.success("Audio analytics cleared");
  };

  const permColor =
    permission === "granted" ? "text-[hsl(var(--status-active))]" :
    permission === "denied" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Headphones className="w-7 h-7 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-primary">Audio Diagnostics</h1>
            <p className="text-muted-foreground text-xs">Verify mic, speakers, permissions & stream status</p>
          </div>
        </div>

        {/* Status grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mic Permission</p>
            <p className={`text-sm font-bold capitalize flex items-center gap-1.5 mt-1 ${permColor}`}>
              {permission === "granted" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {permission}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Stream</p>
            <p className={`text-sm font-bold flex items-center gap-1.5 mt-1 ${streamActive ? "text-[hsl(var(--status-active))]" : "text-muted-foreground"}`}>
              {streamActive ? <><CheckCircle2 className="w-4 h-4" /> Active</> : "Idle"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={probeStream} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
            Probe Microphone
          </button>
          <button onClick={refresh} className="px-3 py-2.5 rounded-lg bg-secondary text-muted-foreground" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Devices */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" /> Inputs ({inputs.length})
          </h3>
          {inputs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No input devices detected. Tap "Probe Microphone" to grant access.</p>
          ) : (
            <ul className="space-y-1.5">
              {inputs.map(d => (
                <li key={d.deviceId} className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--status-active))]" /> {d.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" /> Outputs ({outputs.length})
          </h3>
          {outputs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No output devices reported (some browsers hide this list).</p>
          ) : (
            <ul className="space-y-1.5">
              {outputs.map(d => (
                <li key={d.deviceId} className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {d.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recorder */}
        <div className="mb-4">
          <AudioTestWidget />
        </div>

        {/* Local analytics summary */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Session Audio Events ({summary.total})</h3>
            <button onClick={reset} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-destructive">
              <Trash2 className="w-3 h-3" /> Reset
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(summary.counts).map(([k, v]) => (
              <div key={k} className="bg-secondary/40 rounded-lg p-2">
                <p className="text-[9px] text-muted-foreground uppercase">{k.replace(/_/g, " ")}</p>
                <p className="text-base font-bold text-foreground">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioDiagnosticsPage;
