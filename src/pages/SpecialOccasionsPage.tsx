import { Gift, Calendar, Heart, PartyPopper, Cake, Star } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const occasions = [{ icon: <Cake className="w-5 h-5" />, title: "Mom's Birthday", date: "Apr 15", days: 7 },{ icon: <Heart className="w-5 h-5" />, title: "Anniversary", date: "May 20", days: 42 },{ icon: <PartyPopper className="w-5 h-5" />, title: "Graduation Party", date: "Jun 1", days: 54 },{ icon: <Star className="w-5 h-5" />, title: "Father's Day", date: "Jun 15", days: 68 }];
const SpecialOccasionsPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Gift className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Special Occasions</h1><p className="text-muted-foreground text-xs">Never forget an important event</p></div></div>
      <button className="w-full bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-3 font-semibold mb-6"><Calendar className="w-5 h-5" /> Add Occasion</button>
      <h2 className="text-sm font-semibold text-foreground mb-3">Upcoming</h2>
      <div className="space-y-3">{occasions.map(o => (<div key={o.title} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"><div className="p-2 rounded-lg bg-primary/10 text-primary">{o.icon}</div><div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{o.title}</h3><p className="text-xs text-muted-foreground">{o.date}</p></div><span className="text-xs text-primary font-medium">{o.days}d</span></div>))}</div>
    </div>
  </div>
);
export default SpecialOccasionsPage;
