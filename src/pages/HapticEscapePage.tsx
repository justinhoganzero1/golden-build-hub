import { useState } from "react";
import { Zap, Vibrate, Waves, Mountain, Wind } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const scenes = [{ icon: <Waves className="w-8 h-8" />, title: "Ocean Waves", desc: "Calming sea sounds with gentle vibration" },{ icon: <Wind className="w-8 h-8" />, title: "Forest Breeze", desc: "Rustling leaves and bird songs" },{ icon: <Mountain className="w-8 h-8" />, title: "Mountain Rain", desc: "Gentle rainfall on mountain peaks" },{ icon: <Zap className="w-8 h-8" />, title: "Thunder Storm", desc: "Dramatic thunder with deep haptics" }];
const HapticEscapePage = () => {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Vibrate className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Haptic Escape</h1><p className="text-muted-foreground text-xs">Immersive sensory experiences</p></div></div>
        <div className="space-y-3">{scenes.map(s => (<button key={s.title} onClick={() => setActive(active === s.title ? null : s.title)} className={`w-full bg-card border rounded-xl p-5 flex items-center gap-4 text-left transition-all ${active === s.title ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary"}`}><div className={`text-primary ${active === s.title ? "animate-pulse" : ""}`}>{s.icon}</div><div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{s.title}</h3><p className="text-xs text-muted-foreground">{s.desc}</p></div>{active === s.title && <div className="w-3 h-3 rounded-full bg-[hsl(var(--status-active))] animate-pulse" />}</button>))}</div>
      </div>
    </div>
  );
};
export default HapticEscapePage;
