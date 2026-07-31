import { useState } from "react";
import SEO from "@/components/SEO";
import { Video, Film, Wand2 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import PaywallGate from "@/components/PaywallGate";
import { Button } from "@/components/ui/button";
import MovieStudio from "@/components/MovieStudio";

const VideoEditorPage = () => {
  const [studioOpen, setStudioOpen] = useState(true);
  return (
    <PaywallGate requiredTier="monthly" featureName="Video Editor (AI video generation)">
      <SEO title="AI Video Editor — Oracle Lunar" description="Edit and generate cinematic videos with Oracle Lunar AI." path="/video-editor" />
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Video className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Video Editor</h1><p className="text-muted-foreground text-xs">Oracle Lunar cinematic video generator and editor</p></div>
        </div>
        <div className="border border-border bg-card p-5 text-center space-y-3">
          <Film className="w-10 h-10 text-primary mx-auto" />
          <p className="text-sm text-foreground">Create real moving clips, voiceovers, music, sound effects, captions, and an MP4 export inside Oracle Lunar.</p>
          <Button size="lg" className="w-full" onClick={() => setStudioOpen(true)}>
            <Wand2 className="w-5 h-5 mr-2" /> Open Video Generator
          </Button>
        </div>
      </div>
      <MovieStudio open={studioOpen} onOpenChange={setStudioOpen} />
    </div>
    </PaywallGate>
  );
};

export default VideoEditorPage;
