import { useState } from "react";
import { Palette, Shuffle, Download, Sparkles, Loader2 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const styles = ["Cartoon", "Realistic", "Anime", "Pixel Art", "Abstract", "Minimalist"];
const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const AvatarGeneratorPage = () => {
  const [selectedStyle, setSelectedStyle] = useState("Cartoon");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generate = async () => {
    const desc = prompt.trim() || "a cool avatar";
    setIsLoading(true);
    try {
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: `Generate a ${selectedStyle.toLowerCase()} style avatar portrait of ${desc}. Clean background, centered face, high quality.` }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      if (data.images?.[0]?.image_url?.url) {
        setImageUrl(data.images[0].image_url.url);
        toast.success("Avatar generated!");
      } else {
        toast.error("No image returned");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate avatar");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `solace-avatar-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Palette className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Avatar Generator</h1><p className="text-muted-foreground text-xs">Create unique AI avatars</p></div>
        </div>

        <div className="w-48 h-48 mx-auto rounded-full bg-card border-2 border-primary flex items-center justify-center mb-4 overflow-hidden">
          {isLoading ? (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          ) : imageUrl ? (
            <img src={imageUrl} alt="Generated avatar" className="w-full h-full object-cover" />
          ) : (
            <Sparkles className="w-16 h-16 text-primary/30" />
          )}
        </div>

        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe your avatar (e.g. a warrior princess)..."
          className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary mb-4"
        />

        <div className="flex justify-center gap-3 mb-6">
          <button onClick={generate} disabled={isLoading} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />} Generate
          </button>
          <button onClick={downloadImage} disabled={!imageUrl} className="px-6 py-3 bg-secondary text-foreground rounded-xl text-sm flex items-center gap-2 border border-border disabled:opacity-50">
            <Download className="w-4 h-4" /> Save
          </button>
        </div>

        <h2 className="text-sm font-semibold text-foreground mb-3">Style</h2>
        <div className="flex flex-wrap gap-2">
          {styles.map(s => (
            <button key={s} onClick={() => setSelectedStyle(s)}
              className={`px-3 py-2 rounded-full text-xs font-medium transition-colors ${selectedStyle === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AvatarGeneratorPage;
