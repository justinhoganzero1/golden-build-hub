import { BookOpen, Play, Trophy, Clock } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const modules = [{ title: "POS Basics", lessons: 8, duration: "2h", progress: 100 },{ title: "Inventory Management", lessons: 12, duration: "3h", progress: 60 },{ title: "Customer Analytics", lessons: 10, duration: "2.5h", progress: 20 },{ title: "Advanced Reporting", lessons: 6, duration: "1.5h", progress: 0 }];
const POSLearnPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><BookOpen className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">POS Learn</h1><p className="text-muted-foreground text-xs">Master point-of-sale systems</p></div></div>
      <div className="space-y-3">{modules.map(m => (<div key={m.title} className="bg-card border border-border rounded-xl p-4"><div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-foreground">{m.title}</h3><button className="p-1.5 rounded-lg bg-primary/10"><Play className="w-4 h-4 text-primary" /></button></div><div className="flex items-center gap-3 text-xs text-muted-foreground mb-2"><span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{m.lessons} lessons</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.duration}</span></div><div className="w-full h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${m.progress}%` }} /></div><p className="text-[10px] text-muted-foreground mt-1">{m.progress}% complete</p></div>))}</div>
    </div>
  </div>
);
export default POSLearnPage;
