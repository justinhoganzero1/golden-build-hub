import { Sparkles, Bot, MessageCircle, Heart, Gamepad2, Music } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const features = [
  { icon: <MessageCircle className="w-6 h-6" />, title: "Smart Chat", desc: "Natural conversations about anything", status: "Active" },
  { icon: <Bot className="w-6 h-6" />, title: "Task Manager", desc: "Let AI organize your day", status: "Active" },
  { icon: <Heart className="w-6 h-6" />, title: "Wellness Check", desc: "Daily mental health check-ins", status: "Active" },
  { icon: <Music className="w-6 h-6" />, title: "Music Mood", desc: "AI-curated playlists for your mood", status: "Coming soon" },
  { icon: <Gamepad2 className="w-6 h-6" />, title: "Brain Games", desc: "Cognitive exercises and puzzles", status: "Coming soon" },
];

const PersonalAssistantPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Sparkles className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Personal Assistant</h1><p className="text-muted-foreground text-xs">Your AI-powered life manager</p></div>
      </div>
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Today's Summary</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card/50 rounded-lg p-3"><p className="text-lg font-bold text-primary">3</p><p className="text-[10px] text-muted-foreground">Tasks pending</p></div>
          <div className="bg-card/50 rounded-lg p-3"><p className="text-lg font-bold text-primary">2</p><p className="text-[10px] text-muted-foreground">Reminders</p></div>
          <div className="bg-card/50 rounded-lg p-3"><p className="text-lg font-bold text-[hsl(var(--status-active))]">5</p><p className="text-[10px] text-muted-foreground">Completed</p></div>
          <div className="bg-card/50 rounded-lg p-3"><p className="text-lg font-bold text-primary">87%</p><p className="text-[10px] text-muted-foreground">Productivity</p></div>
        </div>
      </div>
      <h2 className="text-sm font-semibold text-foreground mb-3">Features</h2>
      <div className="space-y-3">
        {features.map(f => (
          <button key={f.title} className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">{f.icon}</div>
            <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{f.title}</h3><p className="text-xs text-muted-foreground">{f.desc}</p></div>
            <span className={`text-[10px] px-2 py-1 rounded-full ${f.status === "Active" ? "bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))]" : "bg-secondary text-muted-foreground"}`}>{f.status}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default PersonalAssistantPage;
