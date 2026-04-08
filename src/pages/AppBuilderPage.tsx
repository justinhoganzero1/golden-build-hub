import { Wrench, Code, Layers, Smartphone, Wand2, Plus } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const templates = [
  { icon: <Smartphone className="w-5 h-5" />, title: "Mobile App", desc: "Build a mobile-first application" },
  { icon: <Layers className="w-5 h-5" />, title: "Dashboard", desc: "Data visualization dashboard" },
  { icon: <Code className="w-5 h-5" />, title: "Landing Page", desc: "Marketing landing page" },
  { icon: <Wand2 className="w-5 h-5" />, title: "AI Assistant", desc: "Custom AI-powered tool" },
];

const AppBuilderPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Wrench className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">App Builder</h1><p className="text-muted-foreground text-xs">Build custom mini-apps with AI</p></div>
      </div>
      <button className="w-full bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-3 font-semibold mb-6"><Plus className="w-5 h-5" /> New Project</button>
      <h2 className="text-sm font-semibold text-foreground mb-3">Templates</h2>
      <div className="grid grid-cols-2 gap-3">
        {templates.map(t => (
          <button key={t.title} className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors">
            <div className="text-primary mb-2">{t.icon}</div>
            <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
            <p className="text-[10px] text-muted-foreground">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default AppBuilderPage;
