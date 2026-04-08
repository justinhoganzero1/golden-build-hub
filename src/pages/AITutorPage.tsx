import { GraduationCap, BookOpen, Play, Trophy, Star, Clock } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const courses = [
  { title: "Introduction to AI", progress: 75, lessons: 12, duration: "4h" },
  { title: "Python Programming", progress: 40, lessons: 20, duration: "8h" },
  { title: "Digital Marketing", progress: 10, lessons: 15, duration: "6h" },
  { title: "Financial Literacy", progress: 0, lessons: 10, duration: "3h" },
];

const AITutorPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><GraduationCap className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">AI Tutor</h1><p className="text-muted-foreground text-xs">Learn anything with AI guidance</p></div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-3 bg-card border border-border rounded-xl"><Trophy className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">12</p><p className="text-[10px] text-muted-foreground">Achievements</p></div>
        <div className="text-center p-3 bg-card border border-border rounded-xl"><Star className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">450</p><p className="text-[10px] text-muted-foreground">XP Points</p></div>
        <div className="text-center p-3 bg-card border border-border rounded-xl"><Clock className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">18h</p><p className="text-[10px] text-muted-foreground">Study Time</p></div>
      </div>
      <h2 className="text-sm font-semibold text-foreground mb-3">Your Courses</h2>
      <div className="space-y-3">
        {courses.map(c => (
          <div key={c.title} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
              <button className="p-1.5 rounded-lg bg-primary/10"><Play className="w-4 h-4 text-primary" /></button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{c.lessons} lessons</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration}</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${c.progress}%` }} /></div>
            <p className="text-[10px] text-muted-foreground mt-1">{c.progress}% complete</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default AITutorPage;
