import { useState } from "react";
import { Palette, Shuffle, Download, Sparkles } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const styles = ["Cartoon", "Realistic", "Anime", "Pixel Art", "Abstract", "Minimalist"];
const AvatarGeneratorPage = () => {
  const [selectedStyle, setSelectedStyle] = useState("Cartoon");
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Palette className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Avatar Generator</h1><p className="text-muted-foreground text-xs">Create unique AI avatars</p></div></div>
        <div className="w-40 h-40 mx-auto rounded-full bg-card border-2 border-primary flex items-center justify-center mb-4"><Sparkles className="w-16 h-16 text-primary/30" /></div>
        <div className="flex justify-center gap-3 mb-6">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm flex items-center gap-2"><Shuffle className="w-4 h-4" /> Generate</button>
          <button className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm flex items-center gap-2 border border-border"><Download className="w-4 h-4" /> Save</button>
        </div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Style</h2>
        <div className="flex flex-wrap gap-2">
          {styles.map(s => (<button key={s} onClick={() => setSelectedStyle(s)} className={`px-3 py-2 rounded-full text-xs font-medium transition-colors ${selectedStyle === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>{s}</button>))}
        </div>
      </div>
    </div>
  );
};
export default AvatarGeneratorPage;
