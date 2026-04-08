import { Star, Wand2, Sparkles, Palette, Zap, Gift } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const magicTools = [{ icon: <Wand2 className="w-6 h-6" />, title: "AI Art Generator", desc: "Create stunning artwork from text" },{ icon: <Sparkles className="w-6 h-6" />, title: "Story Writer", desc: "Generate creative stories with AI" },{ icon: <Palette className="w-6 h-6" />, title: "Color Palette", desc: "AI-curated color schemes" },{ icon: <Zap className="w-6 h-6" />, title: "Quick Transform", desc: "Instantly transform any content" },{ icon: <Gift className="w-6 h-6" />, title: "Surprise Me", desc: "Random AI-generated surprise" }];
const MagicHubPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Star className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Magic Hub</h1><p className="text-muted-foreground text-xs">AI magic at your fingertips</p></div></div>
      <div className="space-y-3">{magicTools.map(t => (<button key={t.title} className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left"><div className="p-2 rounded-lg bg-primary/10 text-primary">{t.icon}</div><div><h3 className="text-sm font-semibold text-foreground">{t.title}</h3><p className="text-xs text-muted-foreground">{t.desc}</p></div></button>))}</div>
    </div>
  </div>
);
export default MagicHubPage;
