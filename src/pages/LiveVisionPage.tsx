import { Eye, Camera, Scan, Zap, Info } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const features = [
  { icon: <Scan className="w-6 h-6" />, title: "Object Detection", desc: "Identify objects in real-time" },
  { icon: <Info className="w-6 h-6" />, title: "Text Recognition", desc: "Read and translate text from camera" },
  { icon: <Zap className="w-6 h-6" />, title: "Scene Analysis", desc: "Understand your surroundings" },
];

const LiveVisionPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Eye className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Live Vision</h1><p className="text-muted-foreground text-xs">AI-powered camera analysis</p></div>
      </div>
      <div className="aspect-[4/3] bg-card border border-border rounded-2xl flex items-center justify-center mb-4">
        <div className="text-center"><Camera className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">Tap to activate camera</p><p className="text-xs text-muted-foreground">AI will analyze what it sees</p></div>
      </div>
      <button className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 mb-6">
        <Camera className="w-5 h-5" /> Start Live Vision
      </button>
      <h2 className="text-sm font-semibold text-foreground mb-3">Capabilities</h2>
      <div className="space-y-3">
        {features.map(f => (
          <div key={f.title} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">{f.icon}</div>
            <div><h3 className="text-sm font-semibold text-foreground">{f.title}</h3><p className="text-xs text-muted-foreground">{f.desc}</p></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default LiveVisionPage;
