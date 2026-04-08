import { Heart, Activity, Thermometer, Droplets, TrendingUp } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const metrics = [
  { icon: <Activity className="w-5 h-5" />, label: "Heart Rate", value: "72 bpm", status: "Normal" },
  { icon: <Thermometer className="w-5 h-5" />, label: "Temperature", value: "98.6°F", status: "Normal" },
  { icon: <Droplets className="w-5 h-5" />, label: "Hydration", value: "6/8 glasses", status: "Good" },
  { icon: <TrendingUp className="w-5 h-5" />, label: "Steps", value: "7,432", status: "On track" },
];

const DiagnosticsPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Heart className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Diagnostics</h1><p className="text-muted-foreground text-xs">Health tracking & insights</p></div>
      </div>
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-5 mb-6 text-center">
        <p className="text-xs text-muted-foreground mb-1">Overall Health Score</p>
        <p className="text-4xl font-bold text-primary">87</p>
        <p className="text-xs text-[hsl(var(--status-active))]">Good condition</p>
      </div>
      <div className="space-y-3">
        {metrics.map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">{m.icon}</div>
            <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{m.label}</h3><p className="text-xs text-muted-foreground">{m.status}</p></div>
            <span className="text-sm font-bold text-primary">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default DiagnosticsPage;
