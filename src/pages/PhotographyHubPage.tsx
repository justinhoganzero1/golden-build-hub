import { Camera, Aperture, Sun, Sliders, Wand2, Image } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const tools = [
  { icon: <Sliders className="w-5 h-5" />, title: "Adjust", desc: "Brightness, contrast, saturation" },
  { icon: <Wand2 className="w-5 h-5" />, title: "AI Enhance", desc: "One-tap photo improvement" },
  { icon: <Sun className="w-5 h-5" />, title: "Filters", desc: "Professional photo filters" },
  { icon: <Aperture className="w-5 h-5" />, title: "Portrait Mode", desc: "Background blur & bokeh" },
];

const PhotographyHubPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Camera className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Photography Hub</h1><p className="text-muted-foreground text-xs">Capture & edit stunning photos</p></div>
      </div>
      <button className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 mb-4"><Camera className="w-5 h-5" /> Open Camera</button>
      <button className="w-full py-4 bg-card border border-border text-foreground font-medium rounded-xl flex items-center justify-center gap-2 mb-6"><Image className="w-5 h-5 text-primary" /> Choose from Gallery</button>
      <h2 className="text-sm font-semibold text-foreground mb-3">Editing Tools</h2>
      <div className="grid grid-cols-2 gap-3">
        {tools.map(t => (
          <button key={t.title} className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors">
            <div className="text-primary mb-2">{t.icon}</div><h3 className="text-sm font-semibold text-foreground">{t.title}</h3><p className="text-[10px] text-muted-foreground">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default PhotographyHubPage;
