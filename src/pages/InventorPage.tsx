import { Lightbulb, Wand2, Rocket, FileText, Plus } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const inventions = [
  { title: "Smart Plant Watering System", stage: "Prototype", progress: 60 },
  { title: "AI Recipe Generator", stage: "Concept", progress: 25 },
  { title: "Automated Budget Tracker", stage: "Testing", progress: 85 },
];

const InventorPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Lightbulb className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Inventor</h1><p className="text-muted-foreground text-xs">Turn ideas into reality with AI</p></div>
      </div>
      <button className="w-full bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-3 font-semibold mb-4"><Plus className="w-5 h-5" /> New Invention</button>
      <button className="w-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 flex items-center gap-3 mb-6">
        <Wand2 className="w-5 h-5 text-primary" /><div className="text-left"><h3 className="text-sm font-semibold text-foreground">AI Idea Generator</h3><p className="text-xs text-muted-foreground">Describe a problem, get invention ideas</p></div>
      </button>
      <h2 className="text-sm font-semibold text-foreground mb-3">Your Inventions</h2>
      <div className="space-y-3">
        {inventions.map(inv => (
          <div key={inv.title} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">{inv.title}</h3>
              <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary">{inv.stage}</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${inv.progress}%` }} /></div>
            <p className="text-[10px] text-muted-foreground mt-1">{inv.progress}% complete</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default InventorPage;
