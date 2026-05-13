import { useState } from "react";
import SEO from "@/components/SEO";
import { Video, Scissors, Type, Music, Image, Layers, Play, Upload } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import PaywallGate from "@/components/PaywallGate";
import { HeyGenAffiliateCTA } from "@/components/HeyGenAffiliateCTA";

const tools = [
  { icon: <Scissors className="w-5 h-5" />, label: "Trim & Cut" },
  { icon: <Type className="w-5 h-5" />, label: "Add Text" },
  { icon: <Music className="w-5 h-5" />, label: "Add Audio" },
  { icon: <Image className="w-5 h-5" />, label: "Filters" },
  { icon: <Layers className="w-5 h-5" />, label: "Layers" },
];

const VideoEditorPage = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  return (
    <PaywallGate requiredTier="monthly" featureName="Video Editor (AI video generation)">
      <SEO title="AI Video Editor — Oracle Lunar" description="Edit and generate cinematic videos with Oracle Lunar AI." path="/video-editor" />
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Video className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Video Editor</h1><p className="text-muted-foreground text-xs">Professional video editing tools</p></div>
        </div>
        <div className="aspect-video bg-card border border-border rounded-xl flex items-center justify-center mb-4">
          <div className="text-center"><Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">Tap to upload a video</p><p className="text-xs text-muted-foreground">MP4, MOV up to 500MB</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2"><Play className="w-4 h-4 text-primary" /><div className="flex-1 h-1 bg-secondary rounded-full"><div className="w-1/3 h-full bg-primary rounded-full" /></div><span className="text-[10px] text-muted-foreground">0:00 / 0:00</span></div>
          <div className="h-12 bg-secondary/50 rounded-lg flex items-center justify-center"><p className="text-xs text-muted-foreground">Timeline — add clips to begin</p></div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tools.map(t => (
            <button key={t.label} onClick={() => setSelectedTool(t.label)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl min-w-[72px] transition-colors ${selectedTool === t.label ? "bg-primary text-primary-foreground" : "bg-card border border-border text-primary"}`}>
              {t.icon}<span className="text-[10px]">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <HeyGenAffiliateCTA
            placement="video_editor_avatar"
            title="Add a Talking AI Avatar"
            description="Generate a HeyGen avatar clip and drop it straight into your timeline."
            ctaLabel="Create Avatar Clip →"
          />
        </div>
      </div>
    </div>
    </PaywallGate>
  );
};

export default VideoEditorPage;
