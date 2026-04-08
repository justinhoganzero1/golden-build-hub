import { Users, MessageCircle, Plus, Heart, Smile } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const friends = [
  { name: "Luna", personality: "Creative & Artistic", mood: "Happy", avatar: "🌙" },
  { name: "Max", personality: "Analytical & Logical", mood: "Focused", avatar: "🤖" },
  { name: "Aria", personality: "Empathetic & Caring", mood: "Calm", avatar: "💜" },
  { name: "Spark", personality: "Energetic & Fun", mood: "Excited", avatar: "⚡" },
];

const MyAIFriendsPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Users className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">My AI Friends</h1><p className="text-muted-foreground text-xs">Your AI companion network</p></div>
      </div>
      <button className="w-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 flex items-center gap-3 mb-6">
        <Plus className="w-5 h-5 text-primary" /><div className="text-left"><h3 className="text-sm font-semibold text-foreground">Create New Friend</h3><p className="text-xs text-muted-foreground">Design a custom AI personality</p></div>
      </button>
      <div className="space-y-3">
        {friends.map(f => (
          <div key={f.name} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">{f.avatar}</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">{f.name}</h3>
              <p className="text-xs text-muted-foreground">{f.personality}</p>
              <div className="flex items-center gap-1 mt-1"><Smile className="w-3 h-3 text-primary" /><span className="text-[10px] text-muted-foreground">{f.mood}</span></div>
            </div>
            <button className="p-2 rounded-lg bg-primary/10"><MessageCircle className="w-5 h-5 text-primary" /></button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default MyAIFriendsPage;
