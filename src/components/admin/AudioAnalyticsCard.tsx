import { useEffect, useState } from "react";
import { Headphones, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { summarizeAudioEvents, type AudioEvent } from "@/lib/audioAnalytics";

const LABELS: Record<AudioEvent, string> = {
  permission_requested: "Perm Req",
  permission_granted: "Granted",
  permission_denied: "Denied",
  recording_started: "Rec Start",
  recording_stopped: "Rec Stop",
  playback_click: "Playback",
  playback_ended: "Pb End",
  device_enumerated: "Devices",
};

const AudioAnalyticsCard = () => {
  const [data, setData] = useState(() => summarizeAudioEvents());

  const refresh = () => setData(summarizeAudioEvents());
  useEffect(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  const max = Math.max(1, ...Object.values(data.counts));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Headphones className="w-4 h-4 text-primary" /> Audio Interactions
          <span className="text-[10px] text-muted-foreground font-normal">({data.total} events)</span>
        </h3>
        <div className="flex items-center gap-2">
          <Link to="/diagnostics/audio" className="text-[10px] text-primary underline">Open</Link>
          <button onClick={refresh} className="p-1 rounded text-muted-foreground hover:text-foreground" aria-label="Refresh">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {(Object.entries(data.counts) as [AudioEvent, number][]).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-20 shrink-0">{LABELS[k]}</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-amber-500 transition-[width] duration-300"
                style={{ width: `${(v / max) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-foreground w-8 text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AudioAnalyticsCard;
