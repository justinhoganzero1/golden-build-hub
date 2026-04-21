import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trackAudioEvent } from "@/lib/audioAnalytics";

/**
 * Compact recorder/playback widget. Used on the diagnostics page and embeddable
 * anywhere a quick "is my mic working?" check is needed.
 */
const AudioTestWidget = () => {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close().catch(() => {});
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const start = async () => {
    setBusy(true);
    trackAudioEvent("permission_requested");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      trackAudioEvent("permission_granted");
      streamRef.current = stream;

      // Live level meter
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 2));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      trackAudioEvent("recording_started");
    } catch (e: any) {
      console.error(e);
      trackAudioEvent("permission_denied", { error: e?.message });
      toast.error(e?.name === "NotAllowedError" ? "Microphone permission denied" : "Could not access microphone");
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close().catch(() => {});
    setRecording(false);
    setLevel(0);
    trackAudioEvent("recording_stopped");
  };

  const clear = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" /> Audio Test
        </h3>
        {recording && <span className="text-[10px] font-bold text-destructive animate-pulse">● REC</span>}
      </div>

      {/* Level meter */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-primary to-amber-500 transition-[width] duration-75"
          style={{ width: `${level * 100}%` }}
        />
      </div>

      <div className="flex gap-2">
        {!recording ? (
          <button
            onClick={start}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            Record
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold"
          >
            <Square className="w-4 h-4" /> Stop
          </button>
        )}
        {audioUrl && (
          <button
            onClick={clear}
            className="px-3 py-2.5 rounded-lg bg-secondary text-muted-foreground"
            aria-label="Clear recording"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {audioUrl && (
        <div className="mt-3">
          <audio
            src={audioUrl}
            controls
            className="w-full"
            onPlay={() => trackAudioEvent("playback_click")}
            onEnded={() => trackAudioEvent("playback_ended")}
          />
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <Play className="w-3 h-3" /> Playback ready — tap play to verify your speaker.
          </p>
        </div>
      )}
    </div>
  );
};

export default AudioTestWidget;
