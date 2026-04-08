import { Film, Play, Star, Clock, Plus } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const projects = [
  { title: "Summer Memories", scenes: 8, duration: "3:24", status: "In Progress" },
  { title: "Birthday Surprise", scenes: 5, duration: "1:45", status: "Complete" },
  { title: "Travel Vlog", scenes: 12, duration: "5:10", status: "Draft" },
];

const MovieMakerPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Film className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Movie Maker</h1><p className="text-muted-foreground text-xs">Create stunning movies with AI</p></div>
      </div>
      <button className="w-full bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-3 font-semibold mb-6"><Plus className="w-5 h-5" /> New Movie Project</button>
      <h2 className="text-sm font-semibold text-foreground mb-3">Your Projects</h2>
      <div className="space-y-3">
        {projects.map(p => (
          <div key={p.title} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
              <span className={`text-[10px] px-2 py-1 rounded-full ${p.status === "Complete" ? "bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))]" : p.status === "In Progress" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{p.status}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Star className="w-3 h-3" />{p.scenes} scenes</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{p.duration}</span></div>
            <button className="mt-3 flex items-center gap-1 text-xs text-primary"><Play className="w-3 h-3" /> Continue editing</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default MovieMakerPage;
