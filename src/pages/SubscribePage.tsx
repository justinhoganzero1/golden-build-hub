import { Star, Check, Zap, Crown, Users, Sparkles } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const plans = [
  { name: "Free", price: "$0", period: "forever", features: ["Oracle AI chat", "1 AI friend included", "5 basic features", "Limited storage"], icon: <Star className="w-6 h-6" />, current: true, badge: null },
  { name: "Starter", price: "$5", period: "/month", features: ["Unlimited Oracle chat", "1 AI friend included", "All 42 features", "5GB storage"], icon: <Zap className="w-6 h-6" />, current: false, badge: null },
  { name: "Pro", price: "$10", period: "/3 months", features: ["Everything in Starter", "3 AI friends included", "10GB storage", "Priority support", "Voice studio access"], icon: <Zap className="w-6 h-6" />, current: false, badge: "POPULAR" },
  { name: "Premium", price: "$50", period: "/12 months", features: ["Everything in Pro", "5 AI friends included", "AI video generation", "50GB storage", "24/7 VIP support"], icon: <Crown className="w-6 h-6" />, current: false, badge: "BEST VALUE" },
  { name: "Polarity", price: "$99", period: "/12 months", features: ["Everything in Premium", "Unlimited AI friends", "Unlimited storage", "Early access to all features", "Custom AI personalities", "White-glove support"], icon: <Sparkles className="w-6 h-6" />, current: false, badge: "ULTIMATE" },
];

const addons = [
  { name: "Extra AI Friend", price: "$1", description: "Add one more AI friend to your Oracle chat (one-time)", icon: <Users className="w-5 h-5" /> },
];

const SubscribePage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/10"><Star className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Subscribe</h1><p className="text-muted-foreground text-xs">Unlock premium features & AI friends</p></div>
      </div>

      {/* Plans */}
      <div className="space-y-4">
        {plans.map(p => (
          <div key={p.name} className={`bg-card border rounded-2xl p-5 ${p.name === "Pro" ? "border-primary" : p.name === "Polarity" ? "border-[#EAB308]" : "border-border"}`}>
            {p.badge && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.name === "Polarity" ? "bg-[#EAB308] text-black" : "bg-primary text-primary-foreground"}`}>{p.badge}</span>}
            <div className="flex items-center gap-3 mt-2 mb-3">
              <div className={p.name === "Polarity" ? "text-[#EAB308]" : "text-primary"}>{p.icon}</div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                <p className="text-xs text-muted-foreground"><span className="text-xl font-bold text-primary">{p.price}</span> {p.period}</p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {p.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[hsl(var(--status-active))]" />
                  <span className="text-xs text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
            <button className={`w-full py-3 rounded-xl text-sm font-semibold ${p.current ? "bg-secondary text-muted-foreground border border-border" : p.name === "Polarity" ? "bg-[#EAB308] text-black" : "bg-primary text-primary-foreground"}`}>
              {p.current ? "Current Plan" : "Upgrade"}
            </button>
          </div>
        ))}
      </div>

      {/* Add-ons */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-foreground mb-3">Add-ons</h2>
        {addons.map(a => (
          <div key={a.name} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">{a.icon}</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">{a.name} — {a.price}</h3>
              <p className="text-xs text-muted-foreground">{a.description}</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">Buy</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SubscribePage;
