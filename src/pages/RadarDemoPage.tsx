import { Radar, MapPin, Users, Wifi } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const nearby = [{ name: "Coffee Shop", distance: "0.2 mi", type: "Food" },{ name: "Gym & Fitness", distance: "0.5 mi", type: "Health" },{ name: "Public Library", distance: "0.8 mi", type: "Education" },{ name: "Community Center", distance: "1.2 mi", type: "Social" }];
const RadarDemoPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Radar className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Radar</h1><p className="text-muted-foreground text-xs">Discover nearby services</p></div></div>
      <div className="w-48 h-48 mx-auto rounded-full border-2 border-primary/30 flex items-center justify-center mb-6 relative"><div className="w-32 h-32 rounded-full border border-primary/20 flex items-center justify-center"><div className="w-16 h-16 rounded-full border border-primary/10 flex items-center justify-center"><div className="w-4 h-4 rounded-full bg-primary animate-ping" /></div></div><div className="absolute top-4 right-8 w-3 h-3 rounded-full bg-[hsl(var(--status-active))]" /><div className="absolute bottom-8 left-4 w-3 h-3 rounded-full bg-primary" /><div className="absolute top-12 left-8 w-3 h-3 rounded-full bg-primary/60" /></div>
      <h2 className="text-sm font-semibold text-foreground mb-3">Nearby</h2>
      <div className="space-y-2">{nearby.map(n => (<div key={n.name} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4"><div className="p-2 rounded-lg bg-primary/10"><MapPin className="w-4 h-4 text-primary" /></div><div className="flex-1"><p className="text-sm font-semibold text-foreground">{n.name}</p><p className="text-xs text-muted-foreground">{n.type}</p></div><span className="text-xs text-primary">{n.distance}</span></div>))}</div>
    </div>
  </div>
);
export default RadarDemoPage;
