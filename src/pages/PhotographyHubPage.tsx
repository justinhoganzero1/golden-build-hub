import { useState } from "react";
import { Camera, Wand2, Loader2, Download, Sparkles } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const filters = ["None", "Vivid", "Noir", "Vintage", "Dreamy", "Cinematic"];

const PhotographyHubPage = () => {
  const [prompt, setPrompt] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("None");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generatePhoto = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGeneratedImage(null);
    const filterPrompt = selectedFilter !== "None" ? `, ${selectedFilter.toLowerCase()} photography style` : "";
    try {
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: `Professional high-resolution photograph: ${prompt.trim()}${filterPrompt}. DSLR quality, sharp focus, beautiful composition.` }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      if (data.images?.[0]?.image_url?.url) {
        setGeneratedImage(data.images[0].image_url.url);
        toast.success("Photo generated!");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate photo");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Camera className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Photography Hub</h1><p className="text-muted-foreground text-xs">AI-powered photo creation</p></div>
        </div>

        {/* Preview */}
        {generatedImage && (
          <div className="aspect-square bg-card border border-primary/30 rounded-xl mb-4 overflow-hidden relative">
            <img src={generatedImage} alt="Generated photo" className="w-full h-full object-cover" />
            <button onClick={() => {
              const a = document.createElement("a");
              a.href = generatedImage;
              a.download = `solace-photo-${Date.now()}.png`;
              a.click();
            }} className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg"><Download className="w-4 h-4 text-white" /></button>
          </div>
        )}

        {/* Generate */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI Photo Generator</span>
          </div>
          <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && generatePhoto()}
            placeholder="Describe the photo you want (e.g. sunset over mountains)..."
            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary mb-3" />
          <button onClick={generatePhoto} disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? "Generating..." : "Generate Photo"}
          </button>
        </div>

        {/* Filters */}
        <h2 className="text-sm font-semibold text-foreground mb-3">Style Filter</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map(f => (
            <button key={f} onClick={() => setSelectedFilter(f)}
              className={`px-3 py-2 rounded-full text-xs font-medium transition-colors ${selectedFilter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PhotographyHubPage;
