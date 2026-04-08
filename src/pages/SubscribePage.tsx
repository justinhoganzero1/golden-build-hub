import { Star, Check, Zap, Crown } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const plans = [
  { name: "Free", price: "$0", period: "forever", features: ["Basic AI chat", "5 features", "Limited storage"], icon: <Star className="w-6 h-6" />, current: true },
  { name: "Pro", price: "$9.99", period: "/month", features: ["Unlimited AI chat", "All 42 features", "10GB storage", "Priority support"], icon: <Zap className="w-6 h-6" />, current: false },
  { name: "Premium", price: "$19.99", period: "/month", features: ["Everything in Pro", "AI video generation", "Unlimited storage", "24/7 VIP support", "Early access"], icon: <Crown className="w-6 h-6" />, current: false },
];
const SubscribePage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-6"><div className="p-2 rounded-xl bg-primary/10"><Star className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Subscribe</h1><p className="text-muted-foreground text-xs">Unlock premium features</p></div></div>
      <div className="space-y-4">{plans.map(p => (<div key={p.name} className={`bg-card border rounded-2xl p-5 ${p.name === "Pro" ? "border-primary" : "border-border"}`}>{p.name === "Pro" && <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">POPULAR</span>}<div className="flex items-center gap-3 mt-2 mb-3"><div className="text-primary">{p.icon}</div><div><h3 className="text-lg font-bold text-foreground">{p.name}</h3><p className="text-xs text-muted-foreground"><span className="text-xl font-bold text-primary">{p.price}</span> {p.period}</p></div></div><div className="space-y-2 mb-4">{p.features.map(f => (<div key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-[hsl(var(--status-active))]" /><span className="text-xs text-muted-foreground">{f}</span></div>))}</div><button className={`w-full py-3 rounded-xl text-sm font-semibold ${p.current ? "bg-secondary text-muted-foreground border border-border" : "bg-primary text-primary-foreground"}`}>{p.current ? "Current Plan" : "Upgrade"}</button></div>))}</div>
    </div>
  </div>
);
export default SubscribePage;
