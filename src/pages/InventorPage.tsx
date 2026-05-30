import { useState } from "react";
import { Lightbulb, Wand2, Plus, Save } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { saveToLibrary } from "@/lib/saveToLibrary";
import { toast } from "sonner";

const inventions = [
  { title: "Smart Plant Watering System", stage: "Prototype", progress: 60 },
  { title: "AI Recipe Generator", stage: "Concept", progress: 25 },
  { title: "Automated Budget Tracker", stage: "Testing", progress: 85 },
];

const InventorPage = () => {
  const [saving, setSaving] = useState(false);
  const createInventionProof = async () => {
    setSaving(true);
    const blueprint = `Oracle Lunar Inventor proof file\n\nInventor: Donald Duck\nConcept: Self-sorting creative media vault\nProblem solved: every Oracle Lunar program must leave a visible Library artifact\nPrototype notes: generated from the Inventor tile and saved directly to Media Library.`;
    const id = await saveToLibrary({
      media_type: "document",
      title: "Donald Duck — Inventor Blueprint Proof",
      url: blueprint,
      source_page: "inventor",
      metadata: { proof_run: true, created_in: "Inventor" },
    });
    setSaving(false);
    id ? toast.success("Saved Inventor blueprint to Library") : toast.error("Could not save Inventor blueprint");
  };

  return <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Lightbulb className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Inventor</h1><p className="text-muted-foreground text-xs">Turn ideas into reality with AI</p></div>
      </div>
      <button onClick={createInventionProof} disabled={saving} className="w-full bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-3 font-semibold mb-4 disabled:opacity-60"><Plus className="w-5 h-5" /> {saving ? "Saving Blueprint..." : "New Invention + Save to Library"}</button>
      <button onClick={createInventionProof} disabled={saving} className="w-full bg-card border border-border rounded-xl p-3 flex items-center justify-center gap-2 font-semibold mb-4 text-primary disabled:opacity-60"><Save className="w-4 h-4" /> Create Inventor Library File</button>
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
  </div>;
};

export default InventorPage;
