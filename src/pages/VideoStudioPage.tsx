import { Film, Clapperboard, Wand2, Upload, Sparkles } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const templates = [
  { title: "Cinematic Intro", style: "Dark & Moody", duration: "15s" },
  { title: "Social Media Ad", style: "Bright & Bold", duration: "30s" },
  { title: "Documentary", style: "Clean & Minimal", duration: "60s" },
  { title: "Music Video", style: "Vibrant & Dynamic", duration: "45s" },
];

const VideoStudioPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Film className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Video Studio</h1><p className="text-muted-foreground text-xs">AI-powered video creation</p></div>
      </div>
      <button className="w-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-6 mb-6 flex flex-col items-center gap-3">
        <div className="p-3 rounded-full bg-primary/10"><Wand2 className="w-8 h-8 text-primary" /></div>
        <h3 className="text-foreground font-semibold">Create with AI</h3>
        <p className="text-xs text-muted-foreground text-center">Describe your video and let AI generate it</p>
      </button>
      <button className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 mb-6">
        <Upload className="w-6 h-6 text-primary" /><div className="text-left"><h3 className="text-sm font-semibold text-foreground">Upload & Edit</h3><p className="text-xs text-muted-foreground">Import your own footage</p></div>
      </button>
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Templates</h2>
      <div className="grid grid-cols-2 gap-3">
        {templates.map(t => (
          <button key={t.title} className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors">
            <Clapperboard className="w-6 h-6 text-primary mb-2" /><h3 className="text-sm font-semibold text-foreground">{t.title}</h3><p className="text-[10px] text-muted-foreground">{t.style} • {t.duration}</p>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default VideoStudioPage;
