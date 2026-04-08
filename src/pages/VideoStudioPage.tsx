import { useState } from "react";
import { Film, Clapperboard, Wand2, Upload, Sparkles, Loader2, Play } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const templates = [
  { title: "Cinematic Intro", style: "Dark & Moody", prompt: "A cinematic dark moody intro scene with dramatic lighting, film grain, lens flare" },
  { title: "Social Media Ad", style: "Bright & Bold", prompt: "A bright bold social media advertisement scene with vibrant colors and modern design" },
  { title: "Documentary", style: "Clean & Minimal", prompt: "A clean minimal documentary-style scene with professional lighting and neutral tones" },
  { title: "Music Video", style: "Vibrant & Dynamic", prompt: "A vibrant dynamic music video scene with neon lights, energetic movement and bold colors" },
];

const VideoStudioPage = () => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateFromPrompt = async (p: string) => {
    if (!p.trim()) return;
    setIsGenerating(true);
    setGeneratedImage(null);
    try {
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: `Generate a high-quality video still/storyboard frame: ${p}. Cinematic, 16:9 widescreen aspect ratio, professional quality.` }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      if (data.images?.[0]?.image_url?.url) {
        setGeneratedImage(data.images[0].image_url.url);
        toast.success("Video concept generated!");
      } else {
        toast.error("No image returned");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Film className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Video Studio</h1><p className="text-muted-foreground text-xs">AI-powered video creation</p></div>
        </div>

        {/* Generated preview */}
        {generatedImage && (
          <div className="aspect-video bg-card border border-primary/30 rounded-xl mb-4 overflow-hidden relative">
            <img src={generatedImage} alt="Generated concept" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Play className="w-12 h-12 text-white/80" /></div>
          </div>
        )}

        {/* Create with AI */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="w-5 h-5 text-primary" />
            <h3 className="text-foreground font-semibold text-sm">Create with AI</h3>
          </div>
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe your video (e.g. a sunset timelapse over the ocean)..."
            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary mb-3"
          />
          <button onClick={() => generateFromPrompt(prompt)} disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? "Generating..." : "Generate Video Concept"}
          </button>
        </div>

        <button className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 mb-6">
          <Upload className="w-6 h-6 text-primary" />
          <div className="text-left"><h3 className="text-sm font-semibold text-foreground">Upload & Edit</h3><p className="text-xs text-muted-foreground">Import your own footage</p></div>
        </button>

        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Quick Templates</h2>
        <div className="grid grid-cols-2 gap-3">
          {templates.map(t => (
            <button key={t.title} onClick={() => generateFromPrompt(t.prompt)} disabled={isGenerating}
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors disabled:opacity-50">
              <Clapperboard className="w-6 h-6 text-primary mb-2" />
              <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
              <p className="text-[10px] text-muted-foreground">{t.style}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoStudioPage;
