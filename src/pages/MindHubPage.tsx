import { useState } from "react";
import { Brain, Smile, Frown, Meh, TrendingUp, BookOpen, Heart } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const moods = [
  { icon: <Smile className="w-8 h-8" />, label: "Great", color: "text-[hsl(var(--status-active))]" },
  { icon: <Smile className="w-8 h-8" />, label: "Good", color: "text-primary" },
  { icon: <Meh className="w-8 h-8" />, label: "Okay", color: "text-muted-foreground" },
  { icon: <Frown className="w-8 h-8" />, label: "Low", color: "text-destructive" },
];

const exercises = [
  { title: "Deep Breathing", duration: "5 min", desc: "Calm your mind with box breathing" },
  { title: "Body Scan", duration: "10 min", desc: "Progressive muscle relaxation" },
  { title: "Gratitude Journal", duration: "3 min", desc: "Write 3 things you're grateful for" },
  { title: "Guided Meditation", duration: "15 min", desc: "Mindfulness meditation session" },
];

const MindHubPage = () => {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Brain className="w-7 h-7 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-primary">Mind Hub</h1>
            <p className="text-muted-foreground text-xs">Your mental wellness center</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">How are you feeling?</h2>
          <div className="flex justify-around">
            {moods.map((m, i) => (
              <button key={i} onClick={() => setSelectedMood(i)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${selectedMood === i ? "bg-primary/10 scale-110" : "hover:bg-secondary"}`}>
                <span className={m.color}>{m.icon}</span>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">This Week</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-secondary/50"><p className="text-lg font-bold text-primary">5</p><p className="text-[10px] text-muted-foreground">Check-ins</p></div>
            <div className="text-center p-3 rounded-lg bg-secondary/50"><p className="text-lg font-bold text-primary">3h</p><p className="text-[10px] text-muted-foreground">Mindfulness</p></div>
            <div className="text-center p-3 rounded-lg bg-secondary/50"><p className="text-lg font-bold text-[hsl(var(--status-active))]">↑12%</p><p className="text-[10px] text-muted-foreground">Improvement</p></div>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-primary" />Wellness Exercises</h2>
        <div className="space-y-3">
          {exercises.map(ex => (
            <button key={ex.title} className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left">
              <div className="p-2 rounded-lg bg-primary/10"><BookOpen className="w-5 h-5 text-primary" /></div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{ex.title}</h3>
                <p className="text-xs text-muted-foreground">{ex.desc}</p>
              </div>
              <span className="text-xs text-primary font-medium">{ex.duration}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MindHubPage;
