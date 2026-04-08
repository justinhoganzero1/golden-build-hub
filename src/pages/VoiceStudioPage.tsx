import { useState } from "react";
import { Music, Mic, Play, Square, Save, Wand2 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const VoiceStudioPage = () => {
  const [recording, setRecording] = useState(false);
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Music className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Voice Studio</h1><p className="text-muted-foreground text-xs">Record, edit & enhance audio</p></div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 mb-4">
          <div className="h-24 flex items-center justify-center gap-[2px] mb-4">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className={`w-1 rounded-full bg-primary transition-all ${recording ? "animate-pulse" : ""}`} style={{ height: `${Math.random() * 60 + 20}%`, animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mb-4">{recording ? "Recording..." : "0:00"}</p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setRecording(!recording)} className={`p-5 rounded-full ${recording ? "bg-destructive" : "bg-primary"} text-primary-foreground`}>
              {recording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary transition-colors">
            <Wand2 className="w-5 h-5 text-primary" /><span className="text-xs text-foreground">AI Enhance</span>
          </button>
          <button className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary transition-colors">
            <Save className="w-5 h-5 text-primary" /><span className="text-xs text-foreground">Save Recording</span>
          </button>
        </div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent Recordings</h2>
        <div className="space-y-2">
          {["Meeting Notes", "Voice Memo", "Song Idea"].map(r => (
            <div key={r} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
              <button className="p-2 rounded-lg bg-primary/10"><Play className="w-4 h-4 text-primary" /></button>
              <div className="flex-1"><p className="text-sm text-foreground">{r}</p><p className="text-[10px] text-muted-foreground">Today • 1:24</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoiceStudioPage;
