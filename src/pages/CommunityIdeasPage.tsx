import { Users, ThumbsUp, MessageCircle, Plus, TrendingUp } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const ideas = [
  { title: "AI-powered recipe planner", author: "Sarah M.", votes: 142, comments: 23 },
  { title: "Group meditation sessions", author: "James K.", votes: 98, comments: 15 },
  { title: "Voice-controlled smart home", author: "Maria G.", votes: 76, comments: 8 },
  { title: "Mental health daily journal", author: "Alex P.", votes: 64, comments: 12 },
];
const CommunityIdeasPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Users className="w-7 h-7 text-primary" /></div><div className="flex-1"><h1 className="text-xl font-bold text-primary">Community Ideas</h1><p className="text-muted-foreground text-xs">Collaborate & share ideas</p></div><button className="p-2 rounded-full bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button></div>
      <div className="space-y-3">
        {ideas.map(idea => (
          <div key={idea.title} className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-1">{idea.title}</h3>
            <p className="text-xs text-muted-foreground mb-3">by {idea.author}</p>
            <div className="flex items-center gap-4"><button className="flex items-center gap-1 text-xs text-primary"><ThumbsUp className="w-3.5 h-3.5" /> {idea.votes}</button><span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageCircle className="w-3.5 h-3.5" /> {idea.comments}</span><TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--status-active))] ml-auto" /></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
export default CommunityIdeasPage;
