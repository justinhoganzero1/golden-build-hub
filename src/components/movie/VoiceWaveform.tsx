// Tiny waveform renderer for a voice/music clip so the user can see the shape
// of what will be heard at a given point on the storyboard timeline.
import { useEffect, useRef, useState } from "react";

interface Props {
  url?: string;
  height?: number;
  color?: string;
  className?: string;
  /** Reported back so the timeline can lay out the segment to scale. */
  onDuration?: (seconds: number) => void;
}

const peaksCache = new Map<string, { peaks: number[]; duration: number }>();

const VoiceWaveform = ({ url, height = 28, color = "hsl(45 90% 60%)", className, onDuration }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) { setPeaks(null); return; }
    const cached = peaksCache.get(url);
    if (cached) {
      setPeaks(cached.peaks);
      onDuration?.(cached.duration);
      return;
    }
    (async () => {
      try {
        const Ctor: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new Ctor();
        const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
        const data = buf.getChannelData(0);
        const buckets = 160;
        const size = Math.max(1, Math.floor(data.length / buckets));
        const out: number[] = [];
        for (let i = 0; i < buckets; i++) {
          let peak = 0;
          for (let j = 0; j < size; j++) peak = Math.max(peak, Math.abs(data[i * size + j] || 0));
          out.push(peak);
        }
        void ctx.close();
        peaksCache.set(url, { peaks: out, duration: buf.duration });
        if (cancelled) return;
        setPeaks(out);
        onDuration?.(buf.duration);
      } catch {
        if (!cancelled) setPeaks(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width = canvas.clientWidth || 240;
    const h = canvas.height = height;
    ctx.clearRect(0, 0, w, h);
    if (!peaks?.length) return;
    ctx.fillStyle = color;
    const bw = w / peaks.length;
    peaks.forEach((p, i) => {
      const bh = Math.max(1, p * (h - 2));
      ctx.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 0.5), bh);
    });
  }, [peaks, height, color]);

  if (!url) return null;
  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height }} aria-hidden />;
};

export default VoiceWaveform;
