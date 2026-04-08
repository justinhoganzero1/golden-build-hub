import { useState } from "react";
import { Film, Play, Plus, Loader2, Sparkles, Wand2 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

interface Scene {
  id: string;
  description: string;
  imageUrl: string | null;
  isGenerating: boolean;
}

const MovieMakerPage = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [newScene, setNewScene] = useState("");
  const [title, setTitle] = useState("");

  const addScene = async () => {
    if (!newScene.trim()) return;
    const scene: Scene = { id: Date.now().toString(), description: newScene.trim(), imageUrl: null, isGenerating: true };
    setScenes(prev => [...prev, scene]);
    setNewScene("");

    try {
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: `Cinematic movie still, 16:9 widescreen: ${scene.description}. Professional cinematography, dramatic lighting, film quality.` }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const url = data.images?.[0]?.image_url?.url;
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, imageUrl: url || null, isGenerating: false } : s));
        if (url) toast.success(`Scene "${scene.description.slice(0, 20)}..." generated!`);
      } else {
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isGenerating: false } : s));
        toast.error("Scene generation failed");
      }
    } catch {
      setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isGenerating: false } : s));
      toast.error("Failed to generate scene");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Film className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Movie Maker</h1><p className="text-muted-foreground text-xs">Create stunning movies with AI</p></div>
        </div>

        {/* Title */}
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Movie title..."
          className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-lg font-bold placeholder:text-muted-foreground outline-none focus:border-primary mb-4" />

        {/* Scene list */}
        {scenes.length > 0 && (
          <div className="space-y-3 mb-4">
            {scenes.map((scene, i) => (
              <div key={scene.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="aspect-video bg-secondary/30 flex items-center justify-center relative">
                  {scene.isGenerating ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  ) : scene.imageUrl ? (
                    <img src={scene.imageUrl} alt={scene.description} className="w-full h-full object-cover" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                  )}
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">Scene {i + 1}</span>
                </div>
                <div className="p-3">
                  <p className="text-xs text-foreground">{scene.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add scene */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Add Scene</span>
          </div>
          <input value={newScene} onChange={e => setNewScene(e.target.value)} onKeyDown={e => e.key === "Enter" && addScene()}
            placeholder="Describe the scene (e.g. A hero walking through a misty forest)..."
            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary mb-3" />
          <button onClick={addScene} disabled={!newScene.trim()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Generate Scene
          </button>
        </div>

        {scenes.length > 0 && (
          <button className="w-full py-3 bg-card border border-primary text-primary rounded-xl font-medium text-sm flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> Preview Movie ({scenes.length} scenes)
          </button>
        )}
      </div>
    </div>
  );
};

export default MovieMakerPage;
