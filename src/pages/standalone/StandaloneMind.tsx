import { useEffect, useState } from "react";

const EXERCISES = [
  { name: "Box Breathing", steps: ["Breathe in 4s", "Hold 4s", "Breathe out 4s", "Hold 4s"], cycles: 4 },
  { name: "5-4-3-2-1 Grounding", steps: ["5 things you see", "4 things you feel", "3 things you hear", "2 things you smell", "1 thing you taste"], cycles: 1 },
  { name: "Calm Reset", steps: ["Breathe in slowly", "Soften your shoulders", "Breathe out longer", "Smile gently"], cycles: 5 },
];

/** Simplified Mind Hub: pick an exercise, get a guided timer. */
const StandaloneMind = () => {
  const [active, setActive] = useState<typeof EXERCISES[number] | null>(null);
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next >= active.steps.length) {
        const nc = cycle + 1;
        if (nc >= active.cycles) { setActive(null); setStep(0); setCycle(0); return; }
        setCycle(nc); setStep(0);
      } else {
        setStep(next);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [active, step, cycle]);

  if (active) {
    return (
      <div className="text-center py-12">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{active.name} · Cycle {cycle + 1}/{active.cycles}</div>
        <div className="w-48 h-48 mx-auto rounded-full bg-gradient-to-br from-primary/30 to-amber-500/20 flex items-center justify-center animate-pulse">
          <div className="text-xl font-semibold px-4 text-center">{active.steps[step]}</div>
        </div>
        <button onClick={() => { setActive(null); setStep(0); setCycle(0); }} className="mt-8 text-sm text-muted-foreground hover:text-foreground">Stop</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center mb-4">Pick a quick reset. Each one is under 2 minutes.</p>
      {EXERCISES.map((e) => (
        <button
          key={e.name}
          onClick={() => setActive(e)}
          className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors"
        >
          <div className="font-semibold">{e.name}</div>
          <div className="text-xs text-muted-foreground mt-1">{e.steps.length} steps · {e.cycles} cycle{e.cycles > 1 ? "s" : ""}</div>
        </button>
      ))}
    </div>
  );
};

export default StandaloneMind;
