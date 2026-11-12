import { useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";
import { PRODUCTION_STAGES, productionPercent, productionStage } from "@/lib/productionStages";

export default function ProductionProgress({ expectedSec = 120, className = "" }: { expectedSec?: number; className?: string }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const sec = Math.floor((now - start) / 1000);
  const stage = productionStage(sec);
  const pct = productionPercent(sec, expectedSec);
  return (
    <div role="status" aria-live="polite" className={`rounded-lg border border-primary/30 bg-card/90 p-3 text-xs backdrop-blur ${className}`}>
      <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
        <Clapperboard className="h-4 w-4 text-primary" aria-hidden /> Filming your video
        <span className="ml-auto tabular-nums text-muted-foreground">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-1000" style={{ width: `${pct}%` }} /></div>
      <ul className="mt-2 space-y-1">
        {PRODUCTION_STAGES.slice(0, 3).map((s, i) => (
          <li key={s.label} className={i < stage ? "text-muted-foreground line-through" : i === stage ? "text-primary" : "text-muted-foreground/60"}>{i + 1}. {i === 2 && stage === 3 ? PRODUCTION_STAGES[3].label : s.label}</li>
        ))}
      </ul>
      <p className="mt-2 text-muted-foreground">Usually 1–3 minutes. You can keep chatting — we'll chime when it's ready.</p>
    </div>
  );
}

export function playReadyChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(880, ctx.currentTime); o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.5);
  } catch { /* sound not available */ }
}
