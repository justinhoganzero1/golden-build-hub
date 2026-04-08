import { Share2, TrendingUp, BarChart3, Mail, Globe, Target } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const tools = [{ icon: <TrendingUp className="w-5 h-5" />, title: "Analytics Dashboard", desc: "Track your marketing performance" },{ icon: <Mail className="w-5 h-5" />, title: "Email Campaigns", desc: "Create and send email blasts" },{ icon: <Globe className="w-5 h-5" />, title: "Social Media Manager", desc: "Schedule and manage posts" },{ icon: <Target className="w-5 h-5" />, title: "Ad Creator", desc: "AI-powered ad generation" },{ icon: <BarChart3 className="w-5 h-5" />, title: "SEO Tools", desc: "Optimize your content for search" }];
const MarketingHubPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Share2 className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Marketing Hub</h1><p className="text-muted-foreground text-xs">Grow your brand with AI</p></div></div>
      <div className="grid grid-cols-3 gap-3 mb-6"><div className="text-center p-3 bg-card border border-border rounded-xl"><p className="text-lg font-bold text-primary">2.4K</p><p className="text-[10px] text-muted-foreground">Reach</p></div><div className="text-center p-3 bg-card border border-border rounded-xl"><p className="text-lg font-bold text-primary">348</p><p className="text-[10px] text-muted-foreground">Clicks</p></div><div className="text-center p-3 bg-card border border-border rounded-xl"><p className="text-lg font-bold text-[hsl(var(--status-active))]">14.5%</p><p className="text-[10px] text-muted-foreground">Conv Rate</p></div></div>
      <div className="space-y-3">{tools.map(t => (<button key={t.title} className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left"><div className="p-2 rounded-lg bg-primary/10 text-primary">{t.icon}</div><div><h3 className="text-sm font-semibold text-foreground">{t.title}</h3><p className="text-xs text-muted-foreground">{t.desc}</p></div></button>))}</div>
    </div>
  </div>
);
export default MarketingHubPage;
