import { Home, Users, Calendar, ShoppingCart, MapPin, Heart } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const members = [{ name: "Mom", status: "Home", avatar: "👩" },{ name: "Dad", status: "Work", avatar: "👨" },{ name: "Emma", status: "School", avatar: "👧" },{ name: "Max", status: "Home", avatar: "🐕" }];
const quickActions = [{ icon: <Calendar className="w-5 h-5" />, label: "Family Calendar" },{ icon: <ShoppingCart className="w-5 h-5" />, label: "Shopping List" },{ icon: <MapPin className="w-5 h-5" />, label: "Location Sharing" },{ icon: <Heart className="w-5 h-5" />, label: "Family Goals" }];
const FamilyHubPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Home className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Family Hub</h1><p className="text-muted-foreground text-xs">Your family command center</p></div></div>
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Family Members</h2>
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">{members.map(m => (<div key={m.name} className="flex flex-col items-center gap-1 min-w-[72px]"><div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center text-2xl">{m.avatar}</div><p className="text-xs font-medium text-foreground">{m.name}</p><span className="text-[10px] text-muted-foreground">{m.status}</span></div>))}</div>
      <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">{quickActions.map(a => (<button key={a.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary transition-colors"><div className="text-primary">{a.icon}</div><span className="text-sm text-foreground">{a.label}</span></button>))}</div>
    </div>
  </div>
);
export default FamilyHubPage;
